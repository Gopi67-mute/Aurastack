"""Curriculum, blueprint and mentor generation backed by the Gemini API (google-genai SDK).

This provider only talks to Gemini. The prompts come from app.ai.prompts, each
response schema is its output model's own JSON schema, and the raw JSON goes
back to the calling service (GenerationService, BlueprintService or
MentorService), which owns validation, normalisation, persistence, the timeout
and the lifecycle.
"""

import logging
from collections.abc import Callable
from typing import Any

import httpx
from google import genai
from google.genai import errors, types
from google.genai.client import AsyncClient
from pydantic import SecretStr

from app.ai.prompts import (
    BLUEPRINT_SYSTEM_INSTRUCTION,
    CURRICULUM_SYSTEM_INSTRUCTION,
    MENTOR_SYSTEM_INSTRUCTION,
    build_blueprint_prompt,
    build_curriculum_prompt,
    build_mentor_prompt,
)
from app.ai.provider import BlueprintRequest, CurriculumRequest, MentorRequest
from app.ai.schemas import BlueprintOutputV2, CurriculumOutputV1, MentorOutputV1

logger = logging.getLogger(__name__)


def _without_max_items(schema: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of a JSON schema with every `maxItems` keyword removed.

    Pure: the input is left untouched. Every other keyword, `minItems`
    included, is kept as is.
    """

    def strip(node: Any) -> Any:
        if isinstance(node, dict):
            return {key: strip(value) for key, value in node.items() if key != "maxItems"}
        if isinstance(node, list):
            return [strip(item) for item in node]
        return node

    return strip(schema)


#: Derived from the validation models themselves, so there is no second schema
#: to drift. Gemini rejects the blueprint schema with a bare 400
#: INVALID_ARGUMENT while its many nested `maxItems` bounds are present, so it
#: gets a copy without them; the prompt states the expected counts, and
#: parse_blueprint_output still enforces every original limit with Pydantic.
RESPONSE_SCHEMA: dict[str, Any] = CurriculumOutputV1.model_json_schema()
BLUEPRINT_RESPONSE_SCHEMA: dict[str, Any] = _without_max_items(BlueprintOutputV2.model_json_schema())
MENTOR_RESPONSE_SCHEMA: dict[str, Any] = MentorOutputV1.model_json_schema()

#: Builds an async Gemini client (an async context manager) from an API key.
ClientFactory = Callable[[str], Any]


class GeminiProviderError(Exception):
    """A Gemini call failed or returned nothing usable.

    The message is safe to log: an error class, HTTP code and status, or a
    finish reason. Never the API key, the prompt or Gemini's response body.
    """


def _default_client_factory(api_key: str) -> AsyncClient:
    return genai.Client(api_key=api_key).aio


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: SecretStr,
        model: str,
        client_factory: ClientFactory = _default_client_factory,
    ) -> None:
        self._api_key = api_key
        self.model: str | None = model
        self._client_factory = client_factory

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        """Ask Gemini for a curriculum and return its raw JSON text.

        Raises GeminiProviderError for API, network and empty responses.
        Cancellation (GenerationService's timeout) propagates untouched, and
        closing the client on the way out releases the connection.
        """

        return await self._generate_json(
            kind="curriculum",
            system_instruction=CURRICULUM_SYSTEM_INSTRUCTION,
            contents=build_curriculum_prompt(request),
            response_schema=RESPONSE_SCHEMA,
        )

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        """Ask Gemini for a project blueprint and return its raw JSON text.

        Same error and cancellation behaviour as generate_curriculum; the
        timeout belongs to BlueprintService.
        """

        return await self._generate_json(
            kind="blueprint",
            system_instruction=BLUEPRINT_SYSTEM_INSTRUCTION,
            contents=build_blueprint_prompt(request),
            response_schema=BLUEPRINT_RESPONSE_SCHEMA,
        )

    async def generate_mentor_reply(self, request: MentorRequest) -> str:
        """Ask Gemini for the mentor's answer and return its raw JSON text.

        Same error and cancellation behaviour as generate_curriculum; the
        timeout belongs to MentorService.
        """

        return await self._generate_json(
            kind="mentor",
            system_instruction=MENTOR_SYSTEM_INSTRUCTION,
            contents=build_mentor_prompt(request),
            response_schema=MENTOR_RESPONSE_SCHEMA,
        )

    async def _generate_json(
        self,
        *,
        kind: str,
        system_instruction: str,
        contents: str,
        response_schema: dict[str, Any],
    ) -> str:
        """One structured-output request. `kind` labels the log line only."""

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_json_schema=response_schema,
            # Measured on gemini-3.5-flash: ~20s at LOW versus ~33s at the
            # model's default, with equally valid output. The default would
            # leave a slow response at risk of the generation timeout.
            thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW),
            # No tools are declared; this only silences the SDK's AFC warning.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        try:
            # A client per call: nothing outlives the generation, and the SDK
            # makes no retries of its own, so the caller's timeout is the only
            # time budget.
            async with self._client_factory(self._api_key.get_secret_value()) as client:
                response = await client.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=config,
                )
        # `from None`: the SDK's exception text embeds Gemini's full error body.
        except errors.APIError as exc:
            raise GeminiProviderError(f"Gemini API error: {exc.code} {exc.status}") from None
        except httpx.HTTPError as exc:
            raise GeminiProviderError(f"Gemini request failed: {type(exc).__name__}") from None

        text = response.text
        if not text:
            raise GeminiProviderError(f"Gemini returned no content: {_empty_reason(response)}")

        usage = response.usage_metadata
        logger.info(
            "Gemini %s response: model=%s prompt_tokens=%s output_tokens=%s thinking_tokens=%s",
            kind,
            self.model,
            usage.prompt_token_count if usage else None,
            usage.candidates_token_count if usage else None,
            usage.thoughts_token_count if usage else None,
        )
        return text


def _empty_reason(response: types.GenerateContentResponse) -> str:
    feedback = response.prompt_feedback
    if feedback is not None and feedback.block_reason is not None:
        return f"prompt blocked ({feedback.block_reason.value})"
    if response.candidates and response.candidates[0].finish_reason is not None:
        return f"finish_reason={response.candidates[0].finish_reason.value}"
    return "no candidates"
