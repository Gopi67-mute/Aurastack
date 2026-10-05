"""Curriculum generation backed by the Gemini API (google-genai SDK).

This provider only talks to Gemini. The prompt comes from app.ai.prompts, the
response schema is CurriculumOutputV1's own JSON schema, and the raw JSON goes
back to GenerationService, which owns validation, normalisation, persistence,
the timeout and the project lifecycle.
"""

import logging
from collections.abc import Callable
from typing import Any

import httpx
from google import genai
from google.genai import errors, types
from google.genai.client import AsyncClient
from pydantic import SecretStr

from app.ai.prompts import CURRICULUM_SYSTEM_INSTRUCTION, build_curriculum_prompt
from app.ai.provider import CurriculumRequest
from app.ai.schemas import CurriculumOutputV1

logger = logging.getLogger(__name__)

#: Derived from the validation model itself, so Gemini is constrained by the
#: exact contract the backend enforces; there is no second schema to drift.
RESPONSE_SCHEMA: dict[str, Any] = CurriculumOutputV1.model_json_schema()

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

        config = types.GenerateContentConfig(
            system_instruction=CURRICULUM_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_json_schema=RESPONSE_SCHEMA,
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
                    contents=build_curriculum_prompt(request),
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
            "Gemini curriculum response: model=%s prompt_tokens=%s output_tokens=%s thinking_tokens=%s",
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
