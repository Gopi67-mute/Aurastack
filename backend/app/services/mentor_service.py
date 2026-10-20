"""AI Mentor: one synchronous answer per request, saved per conversation.

    ownership check -> project context (blueprint, learning: best effort)
        -> already saved? return the saved reply
        -> provider (with timeout) -> validate -> save exchange -> reply

Each user has one conversation per context (general, or one per project).
The user message and its reply are saved together, and only once a valid
reply exists: an interrupted or failed request saves nothing, so the client
can retry it. The client's message id makes that retry idempotent. The
client still sends the earlier turns it wants considered.

Every read and write is scoped to the authenticated user, and a project id is
checked through the same services the workspace uses, so a project the
caller does not own is "not found" exactly as everywhere else.

Only the selected project is ever read, and only titles and one-line
summaries of it reach the provider: never lesson content, other projects or
anything about the user beyond what they typed.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pymongo.errors import PyMongoError

from app.ai.provider import (
    AIProvider,
    MentorBlueprintContext,
    MentorLearningContext,
    MentorProjectContext,
    MentorRequest,
    MentorTurn,
)
from app.ai.schemas import InvalidMentorOutputError, parse_mentor_output
from app.schemas.blueprint import Blueprint
from app.schemas.learning import LearningTopic
from app.repositories.mentor_conversation_repository import MentorConversationRepository
from app.schemas.mentor import (
    MAX_STORED_MENTOR_MESSAGES,
    MentorChatRequest,
    MentorContextInfo,
    MentorContextSource,
    MentorConversationOut,
    MentorMessageOut,
    MentorReply,
)
from app.services.blueprint_service import BlueprintService
from app.services.learning_service import LearningService
from app.services.project_service import ProjectNotFoundError, ProjectService

logger = logging.getLogger(__name__)

MentorFailure = Literal["timeout", "provider_error", "invalid_output"]

# User-facing: returned to the client and given to the model as-is.
LIMITATION_PROJECT_GENERATING = (
    "This project is still being generated, so its blueprint and learning curriculum aren't available yet."
)
LIMITATION_PROJECT_FAILED = (
    "Generation failed for this project, so no blueprint or learning curriculum is available."
)
LIMITATION_NO_BLUEPRINT = "No blueprint has been generated for this project yet."
LIMITATION_BLUEPRINT_GENERATING = "The project's blueprint is still being generated."
LIMITATION_BLUEPRINT_UNAVAILABLE = "The project's blueprint couldn't be loaded."
LIMITATION_NO_LEARNING = "No learning curriculum is available for this project yet."
LIMITATION_LEARNING_UNAVAILABLE = "The project's learning progress couldn't be loaded."


class MentorUnavailableError(Exception):
    """The provider timed out, failed, or returned an unusable answer."""

    def __init__(self, reason: MentorFailure) -> None:
        super().__init__(f"Mentor reply failed: {reason}")
        self.reason = reason


class MentorStorageError(Exception):
    """The conversation could not be read or written."""


def mentor_context_key(project_id: str | None) -> str:
    """Matches the client's store/useMentorStore.ts::mentorContextKey."""

    return f"project:{project_id}" if project_id is not None else "general"


class MentorService:
    def __init__(
        self,
        project_service: ProjectService,
        blueprint_service: BlueprintService,
        learning_service: LearningService,
        conversations: MentorConversationRepository,
        provider: AIProvider,
        timeout_seconds: float,
    ) -> None:
        self._projects = project_service
        self._blueprints = blueprint_service
        self._learning = learning_service
        self._conversations = conversations
        self._provider = provider
        self._timeout_seconds = timeout_seconds

    async def reply(self, user_id: str, payload: MentorChatRequest) -> MentorReply:
        """Answer `payload.message`, grounded in the selected project if any,
        and save the exchange to the caller's conversation for that context.
        A retried message that was already saved gets its saved reply back.

        Raises ProjectNotFoundError when the caller does not own the project,
        MentorUnavailableError when no valid answer could be produced, and
        MentorStorageError when the exchange could not be saved.
        """

        started = time.monotonic()
        project: MentorProjectContext | None = None
        info = MentorContextInfo(sources=[], limitations=[])
        if payload.projectId is not None:
            project, info = await self._project_context(user_id, payload.projectId)

        key = mentor_context_key(payload.projectId)
        request = MentorRequest(
            message=payload.message,
            history=tuple(MentorTurn(role=turn.role, content=turn.content) for turn in payload.history),
            project=project,
        )
        outcome = "ready"
        try:
            saved = saved_reply(await self._load(user_id, key), payload.messageId)
            if saved is not None:
                outcome = "replayed"
                return saved
            reply = await self._produce_reply(request)
            return await self._save_exchange(user_id, key, payload, reply, info)
        except MentorUnavailableError as exc:
            outcome = exc.reason
            raise
        except MentorStorageError:
            outcome = "storage_error"
            raise
        finally:
            # Ids, counts and timings only: never the message, history or reply.
            logger.info(
                "Mentor reply: user_id=%s project_id=%s history_turns=%d sources=%s "
                "provider=%s model=%s outcome=%s duration_ms=%d",
                user_id,
                payload.projectId,
                len(payload.history),
                ",".join(info.sources) or "-",
                self._provider.name,
                self._provider.model,
                outcome,
                (time.monotonic() - started) * 1000,
            )

    async def get_conversation(self, user_id: str, project_id: str | None) -> MentorConversationOut:
        """The caller's saved conversation for this context, oldest first;
        empty when nothing has been saved.

        Raises ProjectNotFoundError when the caller does not own the project,
        and MentorStorageError when it could not be read.
        """

        if project_id is not None:
            await self._projects.get_project(user_id, project_id)
        doc = await self._load(user_id, mentor_context_key(project_id))
        messages = [message_out(message) for message in (doc or {}).get("messages", [])]
        return MentorConversationOut(projectId=project_id, messages=messages)

    async def delete_conversation(self, user_id: str, project_id: str | None) -> None:
        """Delete the caller's conversation for this context, if any.

        Raises ProjectNotFoundError when the caller does not own the project,
        and MentorStorageError when it could not be deleted.
        """

        if project_id is not None:
            await self._projects.get_project(user_id, project_id)
        try:
            await self._conversations.delete(user_id, mentor_context_key(project_id))
        except PyMongoError as exc:
            logger.exception("Mentor conversation delete failed: user_id=%s", user_id)
            raise MentorStorageError() from exc

    async def _load(self, user_id: str, key: str) -> dict[str, Any] | None:
        try:
            return await self._conversations.get(user_id, key)
        except PyMongoError as exc:
            logger.exception("Mentor conversation read failed: user_id=%s", user_id)
            raise MentorStorageError() from exc

    async def _save_exchange(
        self,
        user_id: str,
        key: str,
        payload: MentorChatRequest,
        reply: str,
        info: MentorContextInfo,
    ) -> MentorReply:
        now = datetime.now(timezone.utc).isoformat()
        reply_id = uuid4().hex
        messages = [
            {"id": payload.messageId, "role": "user", "content": payload.message, "created_at": now},
            {
                "id": reply_id,
                "role": "mentor",
                "content": reply,
                "context": info.model_dump(),
                "created_at": now,
            },
        ]
        try:
            appended = await self._conversations.append_exchange(
                user_id,
                key,
                payload.projectId,
                messages,
                now=now,
                max_messages=MAX_STORED_MENTOR_MESSAGES,
            )
            if appended:
                return MentorReply(messageId=reply_id, reply=reply, context=info)
            # A concurrent request for the same message saved it first.
            saved = saved_reply(await self._conversations.get(user_id, key), payload.messageId)
        except PyMongoError as exc:
            logger.exception("Mentor conversation write failed: user_id=%s", user_id)
            raise MentorStorageError() from exc
        if saved is None:
            raise MentorStorageError()
        return saved

    async def _produce_reply(self, request: MentorRequest) -> str:
        try:
            raw = await asyncio.wait_for(
                self._provider.generate_mentor_reply(request), timeout=self._timeout_seconds
            )
        except TimeoutError as exc:
            raise MentorUnavailableError("timeout") from exc
        except Exception as exc:
            logger.exception("Mentor provider failed: provider=%s", self._provider.name)
            raise MentorUnavailableError("provider_error") from exc

        try:
            return parse_mentor_output(raw).reply
        except InvalidMentorOutputError as exc:
            # The summary names failing fields only, never the output itself.
            logger.warning("Mentor output rejected: provider=%s detail=%s", self._provider.name, exc)
            raise MentorUnavailableError("invalid_output") from exc

    async def _project_context(
        self, user_id: str, project_id: str
    ) -> tuple[MentorProjectContext, MentorContextInfo]:
        # The ownership check: raises ProjectNotFoundError for anyone else's id.
        project = await self._projects.get_project(user_id, project_id)

        sources: list[MentorContextSource] = ["project"]
        limitations: list[str] = []
        blueprint: MentorBlueprintContext | None = None
        learning: MentorLearningContext | None = None

        if project.status == "generating":
            limitations.append(LIMITATION_PROJECT_GENERATING)
        elif project.status == "failed":
            limitations.append(LIMITATION_PROJECT_FAILED)
        else:
            (blueprint, blueprint_note), (learning, learning_note) = await asyncio.gather(
                self._blueprint_context(user_id, project_id),
                self._learning_context(user_id, project_id),
            )
            for context, source, note in (
                (blueprint, "blueprint", blueprint_note),
                (learning, "learning", learning_note),
            ):
                if context is not None:
                    sources.append(source)
                if note is not None:
                    limitations.append(note)

        context = MentorProjectContext(
            name=project.name,
            description=project.description,
            platforms=tuple(project.platforms or ()),
            tech_stack=tuple(project.techStack or ()),
            status=project.status,
            blueprint=blueprint,
            learning=learning,
            limitations=tuple(limitations),
        )
        info = MentorContextInfo(
            projectId=project.id,
            projectName=project.name,
            sources=sources,
            limitations=limitations,
        )
        return context, info

    async def _blueprint_context(
        self, user_id: str, project_id: str
    ) -> tuple[MentorBlueprintContext | None, str | None]:
        """The blueprint, or None and the limitation explaining why not.
        Best effort: a failed read only leaves the blueprint out."""

        try:
            response = await self._blueprints.get_blueprint(user_id, project_id)
        except ProjectNotFoundError:
            raise
        except Exception:
            logger.exception("Mentor blueprint context failed: project_id=%s", project_id)
            return None, LIMITATION_BLUEPRINT_UNAVAILABLE

        if response.status == "ready" and response.blueprint is not None:
            return blueprint_context(response.blueprint), None
        if response.status == "generating":
            return None, LIMITATION_BLUEPRINT_GENERATING
        return None, LIMITATION_NO_BLUEPRINT

    async def _learning_context(
        self, user_id: str, project_id: str
    ) -> tuple[MentorLearningContext | None, str | None]:
        """Learning progress, or None and the limitation explaining why not.
        Best effort, like _blueprint_context."""

        try:
            learning = await self._learning.get_project_learning(user_id, project_id)
        except ProjectNotFoundError:
            raise
        except Exception:
            logger.exception("Mentor learning context failed: project_id=%s", project_id)
            return None, LIMITATION_LEARNING_UNAVAILABLE

        if not learning.topics:
            return None, LIMITATION_NO_LEARNING
        return learning_context(learning.topics), None


def message_out(message: dict[str, Any]) -> MentorMessageOut:
    return MentorMessageOut(
        id=message["id"],
        role=message["role"],
        content=message["content"],
        context=message.get("context"),
        createdAt=message["created_at"],
    )


def saved_reply(doc: dict[str, Any] | None, message_id: str) -> MentorReply | None:
    """The saved reply to user message `message_id`, if that exchange is
    saved. A user message and its reply are always written together."""

    messages = (doc or {}).get("messages", [])
    for index, message in enumerate(messages[:-1]):
        answer = messages[index + 1]
        if message["id"] == message_id and message["role"] == "user" and answer["role"] == "mentor":
            return MentorReply(
                messageId=answer["id"],
                reply=answer["content"],
                context=MentorContextInfo.model_validate(answer["context"]),
            )
    return None


def blueprint_context(blueprint: Blueprint) -> MentorBlueprintContext:
    """A ready blueprint reduced to the lines the mentor needs."""

    architecture = blueprint.architecture
    return MentorBlueprintContext(
        summary=blueprint.summary,
        tech_stack=tuple(
            f"{choice.category}: {choice.name} - {choice.purpose}" for choice in blueprint.techStack
        ),
        architecture_style=architecture.style,
        architecture_overview=architecture.overview,
        components=tuple(
            f"{component.name} ({component.kind}): {component.responsibility}"
            for component in architecture.components
        ),
        roadmap=tuple(
            f"Phase {phase.order}: {phase.title} - {phase.goal}"
            for phase in sorted(blueprint.roadmap, key=lambda phase: phase.order)
        ),
    )


def learning_context(topics: list[LearningTopic]) -> MentorLearningContext:
    """Topic titles in learning order, split by completion."""

    ordered = sorted(topics, key=lambda topic: topic.order)
    return MentorLearningContext(
        completed=tuple(topic.title for topic in ordered if topic.status == "completed"),
        remaining=tuple(topic.title for topic in ordered if topic.status != "completed"),
    )
