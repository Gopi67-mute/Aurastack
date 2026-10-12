"""Opt-in blueprint lifecycle checks against a real MongoDB (e.g. Atlas).

Confirms the real queries behave as the in-memory fakes do: the unique
`project_blueprints` index, the atomic upserting claim, attempt fencing, the
lease, the project delete cascade and orphan cleanup, and that blueprint
generation never changes a project, its curriculum or its progress.

Skipped unless explicitly enabled. Like test_mongo_generation_live, it only
ever uses a freshly named temporary database whose collections are dropped
afterwards; application data is never touched. Run from backend/:

    MONGO_LIVE_TEST=1 pytest tests/test_mongo_blueprint_live.py
"""

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.ai.deterministic_provider import DeterministicProvider
from app.ai.provider import BlueprintRequest
from app.ai.schemas import BLUEPRINT_SCHEMA_VERSION
from app.repositories.activity_repository import ActivityRepository
from app.repositories.blueprint_repository import BlueprintRepository
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreateRequest
from app.services.activity_service import ActivityService
from app.services.blueprint_service import BlueprintClaim, BlueprintConflictError, BlueprintService
from app.services.generation_service import FAILURE_PROVIDER_ERROR, GenerationService
from app.services.learning_service import LearningService
from app.services.project_service import GENERATION_LEASE, ProjectService
from tests.test_mongo_generation_live import _temporary_database

pytestmark = pytest.mark.skipif(
    os.environ.get("MONGO_LIVE_TEST") != "1",
    reason="live MongoDB test: set MONGO_LIVE_TEST=1 to run",
)

USER = "live-blueprint-user"


class BrokenProvider(DeterministicProvider):
    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        raise RuntimeError("provider down")


async def _indexes(db: AsyncIOMotorDatabase) -> None:
    """The unique indexes connect_to_mongo creates that these flows rely on."""

    await db.project_blueprints.create_index([("project_id", 1)], unique=True)
    await db.learning_progress.create_index(
        [("user_id", 1), ("project_id", 1), ("topic_id", 1)], unique=True
    )
    await db.activity_events.create_index([("user_id", 1), ("id", 1)], unique=True)


class Live:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.projects = ProjectRepository(db)
        self.learning = LearningRepository(db)
        self.blueprints = BlueprintRepository(db)
        activity = ActivityRepository(db)
        self.project_service = ProjectService(self.projects, self.learning, activity, self.blueprints)
        self.learning_service = LearningService(self.projects, self.learning, ActivityService(activity))
        self.generation = GenerationService(
            self.projects, self.learning, DeterministicProvider(), timeout_seconds=30
        )
        self.service = BlueprintService(
            self.projects, self.learning, self.blueprints, DeterministicProvider(), timeout_seconds=30
        )

    async def ready_project(self) -> str:
        project, claim = await self.project_service.create_project(
            USER, ProjectCreateRequest(title="Live Blueprint", description="temporary", platforms=["web"])
        )
        await self.generation.run(claim)
        assert (await self.project_doc(project.id))["status"] == "ready"
        return project.id

    async def project_doc(self, project_id: str) -> dict[str, Any]:
        doc = await self.projects.get_by_id_for_user(project_id, USER)
        assert doc is not None
        return doc

    async def blueprint_docs(self, project_id: str) -> list[dict[str, Any]]:
        return [doc async for doc in self.db.project_blueprints.find({"project_id": project_id})]

    async def status(self, project_id: str) -> str:
        return (await self.service.get_blueprint(USER, project_id)).status

    async def expire(self, project_id: str) -> None:
        started = datetime.now(timezone.utc) - GENERATION_LEASE - timedelta(seconds=5)
        await self.db.project_blueprints.update_one(
            {"project_id": project_id}, {"$set": {"started_at": started.isoformat()}}
        )

    async def generated(self, project_id: str) -> BlueprintClaim:
        _, claim = await self.service.claim(USER, project_id)
        await self.service.run(claim)
        return claim


@pytest.mark.asyncio
async def test_project_blueprints_has_one_unique_project_id_index() -> None:
    async with _temporary_database() as db:
        await _indexes(db)

        info = await db.project_blueprints.index_information()
        assert set(info) == {"_id_", "project_id_1"}
        assert info["project_id_1"]["key"] == [("project_id", 1)]
        assert info["project_id_1"]["unique"] is True

        await db.project_blueprints.insert_one({"project_id": "p1", "user_id": USER})
        with pytest.raises(DuplicateKeyError):
            await db.project_blueprints.insert_one({"project_id": "p1", "user_id": USER})


@pytest.mark.asyncio
async def test_concurrent_first_claims_have_exactly_one_winner() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)
        project_id = await live.ready_project()

        results = await asyncio.gather(
            *(live.service.claim(USER, project_id) for _ in range(8)), return_exceptions=True
        )

        claims = [result for result in results if not isinstance(result, BaseException)]
        conflicts = [result for result in results if isinstance(result, BlueprintConflictError)]
        assert len(claims) == 1
        assert len(conflicts) == 7
        [doc] = await live.blueprint_docs(project_id)
        assert (doc["status"], doc["attempt"], doc["curriculum_version"]) == ("generating", 1, 1)


@pytest.mark.asyncio
async def test_concurrent_retry_claims_after_a_failure_have_exactly_one_winner() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)
        project_id = await live.ready_project()
        live.service._provider = BrokenProvider()
        await live.generated(project_id)
        [failed] = await live.blueprint_docs(project_id)
        assert (failed["status"], failed["failure_reason"]) == ("failed", FAILURE_PROVIDER_ERROR)

        results = await asyncio.gather(
            *(live.service.claim(USER, project_id) for _ in range(8)), return_exceptions=True
        )

        claims = [result for result in results if not isinstance(result, BaseException)]
        assert len(claims) == 1
        assert sum(isinstance(result, BlueprintConflictError) for result in results) == 7
        [doc] = await live.blueprint_docs(project_id)
        assert (doc["status"], doc["attempt"]) == ("generating", 2)
        assert doc["failure_reason"] is None
        assert doc["created_at"] == failed["created_at"]


@pytest.mark.asyncio
async def test_superseded_attempt_cannot_finalize() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)
        project_id = await live.ready_project()
        _, stale = await live.service.claim(USER, project_id)
        await live.expire(project_id)
        _, current = await live.service.claim(USER, project_id)

        await live.service.run(stale)

        [doc] = await live.blueprint_docs(project_id)
        assert (doc["status"], doc["attempt"], doc["blueprint"]) == ("generating", 2, None)

        await live.service.run(current)

        [doc] = await live.blueprint_docs(project_id)
        assert doc["status"] == "ready"
        assert doc["meta"]["attempt"] == current.attempt == 2
        assert await live.status(project_id) == "ready"


@pytest.mark.asyncio
async def test_lease_expiry_reads_failed_and_is_retryable() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)
        project_id = await live.ready_project()
        assert await live.status(project_id) == "missing"

        await live.service.claim(USER, project_id)
        assert await live.status(project_id) == "generating"
        with pytest.raises(BlueprintConflictError) as active:
            await live.service.claim(USER, project_id)
        assert active.value.reason == "generating"

        await live.expire(project_id)
        assert await live.status(project_id) == "failed"

        _, retry = await live.service.claim(USER, project_id)
        assert retry.attempt == 2
        await live.service.run(retry)
        assert await live.status(project_id) == "ready"
        with pytest.raises(BlueprintConflictError) as current:
            await live.service.claim(USER, project_id)
        assert current.value.reason == "ready"


@pytest.mark.asyncio
async def test_blueprint_from_before_schema_versions_is_stale_and_reclaimable() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)
        project_id = await live.ready_project()
        await live.generated(project_id)
        # As stored before schema versions were recorded: ready, current
        # curriculum, no top-level schema_version.
        await db.project_blueprints.update_one(
            {"project_id": project_id}, {"$unset": {"schema_version": ""}}
        )
        assert await live.status(project_id) == "missing"

        _, claim = await live.service.claim(USER, project_id)
        await live.service.run(claim)

        [doc] = await live.blueprint_docs(project_id)
        assert (doc["attempt"], doc["schema_version"]) == (2, BLUEPRINT_SCHEMA_VERSION)
        assert await live.status(project_id) == "ready"


@pytest.mark.asyncio
async def test_delete_cascade_and_orphan_cleanup_leave_no_blueprint() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)

        # Cascade: deleting a project removes its ready blueprint.
        cascaded = await live.ready_project()
        await live.generated(cascaded)
        assert len(await live.blueprint_docs(cascaded)) == 1
        await live.project_service.delete_project(USER, cascaded)
        assert await live.blueprint_docs(cascaded) == []

        # Orphan: a claim lands after the delete's cascade already ran.
        orphaned = await live.ready_project()
        await live.project_service.delete_project(USER, orphaned)
        now = datetime.now(timezone.utc)
        doc = await live.blueprints.claim(
            orphaned,
            USER,
            curriculum_version=1,
            schema_version=BLUEPRINT_SCHEMA_VERSION,
            expired_before=(now - GENERATION_LEASE).isoformat(),
            started_at=now.isoformat(),
        )
        assert doc is not None and len(await live.blueprint_docs(orphaned)) == 1
        await live.service.run(BlueprintClaim(USER, orphaned, attempt=1, curriculum_version=1))
        assert await live.blueprint_docs(orphaned) == []

        # Deleted mid-generation: the fenced finalize never resurrects it.
        racing = await live.ready_project()
        _, claim = await live.service.claim(USER, racing)

        class DeletingProvider(DeterministicProvider):
            async def generate_blueprint(self, request: BlueprintRequest) -> str:
                await live.project_service.delete_project(USER, racing)
                return await super().generate_blueprint(request)

        live.service._provider = DeletingProvider()
        await live.service.run(claim)
        assert await live.blueprint_docs(racing) == []
        assert await live.projects.get_by_id_for_user(racing, USER) is None

        assert await db.project_blueprints.count_documents({}) == 0


@pytest.mark.asyncio
async def test_blueprint_generation_never_changes_project_curriculum_or_progress() -> None:
    async with _temporary_database() as db:
        await _indexes(db)
        live = Live(db)

        async def snapshot(project_id: str) -> tuple[Any, ...]:
            return (
                await live.project_doc(project_id),
                [doc async for doc in db.learning_topics.find({"project_id": project_id}).sort("id", 1)],
                [doc async for doc in db.learning_progress.find({"project_id": project_id}).sort("topic_id", 1)],
                await db.activity_events.count_documents({"project_id": project_id}),
                (await live.project_service.get_project(USER, project_id)).model_dump(),
            )

        succeeded, failed = await live.ready_project(), await live.ready_project()
        for project_id in (succeeded, failed):
            topic = (await live.learning_service.get_project_learning(USER, project_id)).topics[0]
            await live.learning_service.complete_topic(USER, project_id, topic.id)
        before = {project_id: await snapshot(project_id) for project_id in (succeeded, failed)}

        await live.generated(succeeded)
        live.service._provider = BrokenProvider()
        await live.generated(failed)

        assert await live.status(succeeded) == "ready"
        assert await live.status(failed) == "failed"
        for project_id in (succeeded, failed):
            assert await snapshot(project_id) == before[project_id]
            assert before[project_id][4]["progress"] > 0
