"""Idempotent data migrations, run once per startup.

Phase 3.3 — generation lifecycle. Projects written before curriculum metadata
existed (they have no `curriculum` field at all; newer ones always carry it,
null or set) are moved onto the new lifecycle:

* with topics    -> "ready", curriculum version 1; topics stamped version 1
* without topics -> "failed" (legacy_missing_curriculum), so it can be retried

Topic ids are never changed, and learning_progress / activity_events are never
touched, so existing completions and streak idempotency keys stay valid.
Safe to run repeatedly and from several workers at once: each step only
matches documents that have not been migrated yet.

Deployment: this runs at startup, before an instance serves requests. Any
instance still running pre-Phase 3.3 code can keep writing legacy documents
(no `curriculum` field, "preparing" status) that the new code does not
expect, so retire every old instance before or as the new version starts;
a restart of the new version migrates whatever they wrote meanwhile.
"""

import logging
from dataclasses import dataclass
from typing import Any

from app.ai.schemas import CURRICULUM_SCHEMA_VERSION
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.services.generation_service import FAILURE_LEGACY_MISSING_CURRICULUM

logger = logging.getLogger(__name__)

LEGACY_CURRICULUM_VERSION = 1
#: Phase 3.2 curricula all came from the keyword library.
LEGACY_CURRICULUM_SOURCE = "deterministic"


@dataclass(frozen=True)
class MigrationReport:
    ready: int = 0
    failed: int = 0


async def migrate_generation_lifecycle(
    projects: ProjectRepository, learning: LearningRepository
) -> MigrationReport:
    ready = failed = 0

    for doc in await projects.list_without_curriculum_field():
        project_id = doc["id"]

        if await learning.has_topics(project_id):
            # Topics first: if the project update below is lost, a rerun still
            # sees the project as legacy and this step is a no-op the second time.
            await learning.set_missing_curriculum_version(project_id, LEGACY_CURRICULUM_VERSION)
            if await projects.update_if_without_curriculum_field(project_id, _ready_fields(doc)):
                ready += 1
        elif await projects.update_if_without_curriculum_field(project_id, _failed_fields()):
            failed += 1

    report = MigrationReport(ready=ready, failed=failed)
    if ready or failed:
        logger.info(
            "Generation lifecycle migration: %d project(s) ready, %d failed (retryable)",
            report.ready,
            report.failed,
        )
    return report


def _ready_fields(doc: dict[str, Any]) -> dict[str, Any]:
    # Phase 3.2 generated the curriculum in the same request that created
    # the project, so the creation time is when it was generated.
    generated_at = doc["created_at"]
    return {
        "status": "ready",
        "curriculum": {
            "version": LEGACY_CURRICULUM_VERSION,
            "schema_version": CURRICULUM_SCHEMA_VERSION,
            "source": LEGACY_CURRICULUM_SOURCE,
            "model": None,
            "generated_at": generated_at,
        },
        "generation": {
            "attempt": LEGACY_CURRICULUM_VERSION,
            "started_at": generated_at,
            "completed_at": generated_at,
            "failure_reason": None,
        },
    }


def _failed_fields() -> dict[str, Any]:
    # Attempt 0: the first retry claims attempt (and curriculum version) 1.
    return {
        "status": "failed",
        "curriculum": None,
        "generation": {
            "attempt": 0,
            "started_at": None,
            "completed_at": None,
            "failure_reason": FAILURE_LEGACY_MISSING_CURRICULUM,
        },
    }
