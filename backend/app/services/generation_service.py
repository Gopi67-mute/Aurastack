"""Curriculum generation: one provider-agnostic lifecycle for every project.

    claim attempt -> provider (with timeout) -> validate -> normalise
        -> persist topics -> finalise project (ready | failed)

The provider's output is untrusted until it passes CurriculumOutputV1. The
server, never the provider, assigns persisted topic ids. Every write that
makes a curriculum active is fenced on the claimed attempt, so a stale or
superseded run can never overwrite a newer one.

Lost workers: an attempt runs in a FastAPI BackgroundTask, in memory. A
process restart, crash or `--reload` mid-generation loses it silently and
nothing resumes it. The project stays "generating" in MongoDB until its lease
(GENERATION_LEASE_SECONDS) expires; from then on reads report it "failed" and
the user can retry. This is deliberate: there is no queue or worker process.
"""

import asyncio
import logging
import time
from collections.abc import Awaitable
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.ai.provider import AIProvider, CurriculumRequest
from app.ai.schemas import CurriculumOutputV1, InvalidCurriculumOutputError, parse_curriculum_output
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import Project, ProjectStatus
from app.services.project_service import (
    GENERATION_LEASE,
    GenerationClaim,
    ProjectNotFoundError,
    effective_status,
    log_generation_claim,
    project_from_doc,
)

logger = logging.getLogger(__name__)

# Safe, server-side failure codes stored on the project. Never sent to the
# client, and never carry provider text, prompts or stack traces.
FAILURE_TIMEOUT = "generation_timeout"
FAILURE_INVALID_OUTPUT = "invalid_output"
FAILURE_PROVIDER_ERROR = "provider_error"
FAILURE_INTERNAL_ERROR = "internal_error"
#: Set by the Phase 3.3 migration on pre-existing projects that had no topics.
FAILURE_LEGACY_MISSING_CURRICULUM = "legacy_missing_curriculum"


class GenerationConflictError(Exception):
    """The project is not in a state that allows a new generation attempt."""

    def __init__(self, project_id: str, status: ProjectStatus) -> None:
        super().__init__(f"Project {project_id} cannot be regenerated while {status}")
        self.project_id = project_id
        self.status = status


class _GenerationFailure(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class GenerationService:
    def __init__(
        self,
        project_repo: ProjectRepository,
        learning_repo: LearningRepository,
        provider: AIProvider,
        timeout_seconds: float,
    ) -> None:
        self._projects = project_repo
        self._learning = learning_repo
        self._provider = provider
        self._timeout_seconds = timeout_seconds

    async def claim_retry(self, user_id: str, project_id: str) -> tuple[Project, GenerationClaim]:
        """Claim a new attempt for a failed or lease-expired project.

        Atomic: of several concurrent retries exactly one succeeds. Raises
        ProjectNotFoundError when the caller does not own the project, and
        GenerationConflictError when it is actively generating or ready.
        """

        now = datetime.now(timezone.utc)
        doc = await self._projects.claim_generation(
            project_id,
            user_id,
            expired_before=(now - GENERATION_LEASE).isoformat(),
            started_at=now.isoformat(),
        )
        if doc is None:
            existing = await self._projects.get_by_id_for_user(project_id, user_id)
            if existing is None:
                raise ProjectNotFoundError(project_id)
            raise GenerationConflictError(project_id, effective_status(existing, now))

        claim = GenerationClaim(
            user_id=user_id,
            project_id=project_id,
            attempt=doc["generation"]["attempt"],
            trigger="retry",
        )
        log_generation_claim(claim)
        return project_from_doc(doc, now), claim

    async def run(self, claim: GenerationClaim) -> None:
        """Run one claimed attempt to completion. Intended as a background task.

        Never raises: every failure is logged and recorded on the project as
        a retryable "failed" state. Only cancellation propagates, in which
        case the lease expiring makes the project retryable instead.
        """

        started = time.monotonic()
        try:
            outcome = await self._generate(claim)
        except _GenerationFailure as failure:
            outcome = await self._record_failure(claim, failure.reason)
        except Exception:
            logger.exception(
                "Generation crashed: user_id=%s project_id=%s attempt=%s",
                claim.user_id,
                claim.project_id,
                claim.attempt,
            )
            outcome = await self._record_failure(claim, FAILURE_INTERNAL_ERROR)

        # Ids, codes and timings only: never prompts, provider output or
        # project text, which may contain anything the user typed.
        logger.info(
            "Generation finished: trigger=%s user_id=%s project_id=%s attempt=%s provider=%s "
            "model=%s outcome=%s duration_ms=%d",
            claim.trigger,
            claim.user_id,
            claim.project_id,
            claim.attempt,
            self._provider.name,
            self._provider.model,
            outcome,
            (time.monotonic() - started) * 1000,
        )

    async def _generate(self, claim: GenerationClaim) -> str:
        doc = await self._projects.get_by_id_for_user(claim.project_id, claim.user_id)
        if doc is None:
            return "project_deleted"

        output = await self._produce_curriculum(claim, _request_from_doc(doc))

        generated_at = datetime.now(timezone.utc).isoformat()
        await self._learning.insert_topics(
            normalize_curriculum(
                output,
                project_id=claim.project_id,
                curriculum_version=claim.attempt,
                created_at=generated_at,
            )
        )

        activated = await self._projects.finalize_generation(
            claim.project_id,
            claim.user_id,
            claim.attempt,
            {
                "status": "ready",
                "curriculum": {
                    "version": claim.attempt,
                    "schema_version": output.schema_version,
                    "source": self._provider.name,
                    "model": self._provider.model,
                    "generated_at": generated_at,
                },
                "generation.completed_at": generated_at,
                "generation.failure_reason": None,
                "updated_at": generated_at,
            },
        )
        if not activated:
            # Superseded by a newer attempt, or the project was deleted: these
            # topics must never become active.
            await self._discard_topics(claim)
            return "superseded"

        await self._delete_superseded_topics(claim)
        return "ready"

    async def _produce_curriculum(
        self, claim: GenerationClaim, request: CurriculumRequest
    ) -> CurriculumOutputV1:
        try:
            raw = await asyncio.wait_for(
                self._provider.generate_curriculum(request), timeout=self._timeout_seconds
            )
        except TimeoutError as exc:
            logger.warning(
                "Generation timed out after %ss: project_id=%s attempt=%s provider=%s",
                self._timeout_seconds,
                claim.project_id,
                claim.attempt,
                self._provider.name,
            )
            raise _GenerationFailure(FAILURE_TIMEOUT) from exc
        except Exception as exc:
            logger.exception(
                "Provider failed: project_id=%s attempt=%s provider=%s",
                claim.project_id,
                claim.attempt,
                self._provider.name,
            )
            raise _GenerationFailure(FAILURE_PROVIDER_ERROR) from exc

        try:
            return parse_curriculum_output(raw)
        except InvalidCurriculumOutputError as exc:
            # The summary names failing fields only, never the output itself.
            logger.warning(
                "Provider output rejected: project_id=%s attempt=%s provider=%s detail=%s",
                claim.project_id,
                claim.attempt,
                self._provider.name,
                exc,
            )
            raise _GenerationFailure(FAILURE_INVALID_OUTPUT) from exc

    async def _record_failure(self, claim: GenerationClaim, reason: str) -> str:
        """Mark the attempt failed and discard its topics. Returns the outcome.

        Usually `reason`. But "failed" can be a wrong belief: the "ready"
        finalise may have applied in MongoDB and still raised here (e.g. the
        connection dropped before the reply). The fenced write below then
        matches nothing, the attempt's topics are the active curriculum, and
        they are kept: the outcome is "ready".
        """

        now = datetime.now(timezone.utc).isoformat()
        await self._best_effort(
            self._projects.finalize_generation(
                claim.project_id,
                claim.user_id,
                claim.attempt,
                {
                    "status": "failed",
                    "generation.completed_at": now,
                    "generation.failure_reason": reason,
                    "updated_at": now,
                },
            ),
            claim,
            "failure recording",
        )
        if await self._discard_topics(claim):
            await self._delete_superseded_topics(claim)
            return "ready"
        return reason

    async def _discard_topics(self, claim: GenerationClaim) -> bool:
        """Delete the attempt's topics unless they are the active curriculum.

        Callers believe the attempt was not activated, which an ambiguous
        finalise can make wrong, so the project is re-read first. Returns True
        when the attempt is in fact active and its topics were kept. When the
        project cannot be read, the topics are kept too: a curriculum version
        that is not active is never read, and the next successful attempt
        deletes it, whereas deleting an active one empties a ready project.
        """

        try:
            doc = await self._projects.get_by_id_for_user(claim.project_id, claim.user_id)
        except Exception:
            logger.exception(
                "Generation topic cleanup skipped, project unreadable: project_id=%s attempt=%s",
                claim.project_id,
                claim.attempt,
            )
            return False

        if doc is not None and (doc.get("curriculum") or {}).get("version") == claim.attempt:
            logger.warning(
                "Generation finalize was ambiguous but the attempt is active; curriculum kept: "
                "project_id=%s attempt=%s",
                claim.project_id,
                claim.attempt,
            )
            return True

        await self._best_effort(
            self._learning.delete_topics_for_version(claim.project_id, claim.attempt),
            claim,
            "topic cleanup",
        )
        return False

    async def _delete_superseded_topics(self, claim: GenerationClaim) -> None:
        await self._best_effort(
            self._learning.delete_topics_except_version(claim.project_id, claim.attempt),
            claim,
            "superseded topic cleanup",
        )

    async def _best_effort(
        self, operation: Awaitable[object], claim: GenerationClaim, label: str
    ) -> None:
        # If this write is lost, the lease expiring still leaves the project
        # retryable, and unversioned leftovers are never read.
        try:
            await operation
        except Exception:
            logger.exception(
                "Generation %s failed: project_id=%s attempt=%s",
                label,
                claim.project_id,
                claim.attempt,
            )


def normalize_curriculum(
    output: CurriculumOutputV1, *, project_id: str, curriculum_version: int, created_at: str
) -> list[dict[str, Any]]:
    """Turn validated provider output into persisted topic documents.

    The server owns identity and ordering: every topic gets a fresh UUID, and
    orders are renumbered 1..n in the provider's order. The provider's `key`
    is kept as `source_key` for provenance only.
    """

    ordered = sorted(output.topics, key=lambda topic: topic.order)
    return [
        {
            "id": str(uuid4()),
            "project_id": project_id,
            "curriculum_version": curriculum_version,
            "source_key": topic.key,
            "title": topic.title,
            "description": topic.description,
            "order": position,
            "content": topic.content.model_dump(),
            "created_at": created_at,
        }
        for position, topic in enumerate(ordered, start=1)
    ]


def _request_from_doc(doc: dict[str, Any]) -> CurriculumRequest:
    return CurriculumRequest(
        project_name=doc["name"],
        description=doc.get("description"),
        platforms=tuple(doc.get("platforms") or ()),
        tech_stack=tuple(doc.get("tech_stack") or ()),
    )
