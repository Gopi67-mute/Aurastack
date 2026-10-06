"""Opt-in generation lifecycle checks against a real MongoDB (e.g. Atlas).

The in-memory fakes mirror MongoDB's semantics; this confirms the real
queries behave the same: atomic retry claims, attempt fencing, the lease,
and an idempotent legacy migration.

Skipped unless explicitly enabled, so the normal suite and CI never need a
database. It uses MONGODB_URI from the environment or backend/.env, but only
ever a freshly named, temporary database whose collections are dropped afterwards:
existing application data, collections and indexes are never touched. Run:

    MONGO_LIVE_TEST=1 pytest tests/test_mongo_generation_live.py
"""

import asyncio
import copy
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import pytest
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.ai.deterministic_provider import DeterministicProvider
from app.core.config import Settings
from app.db.migrations import MigrationReport, migrate_generation_lifecycle
from app.repositories.learning_repository import LearningRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreateRequest
from app.services.activity_service import ActivityService
from app.services.generation_service import GenerationConflictError, GenerationService
from app.services.learning_service import LearningService
from app.services.project_service import GENERATION_LEASE, GenerationClaim, ProjectService

pytestmark = pytest.mark.skipif(
    os.environ.get("MONGO_LIVE_TEST") != "1",
    reason="live MongoDB test: set MONGO_LIVE_TEST=1 to run",
)

USER = "live-test-user"
TEMP_DB_PREFIX = "aurastack_live_test_"


class _UnusedActivityRepository:
    """Project deletion is not exercised here; nothing may write activity."""

    async def delete_for_project(self, project_id: str) -> None:
        raise AssertionError("activity must not be touched")


@asynccontextmanager
async def _temporary_database() -> AsyncIterator[AsyncIOMotorDatabase]:
    settings = Settings()
    name = f"{TEMP_DB_PREFIX}{uuid4().hex[:12]}"
    # Never the configured database, nor one that already exists.
    assert name != settings.mongodb_db_name
    assert not settings.mongodb_db_name.startswith(TEMP_DB_PREFIX)

    client: AsyncIOMotorClient = AsyncIOMotorClient(
        settings.mongodb_uri, serverSelectionTimeoutMS=15_000
    )
    try:
        assert name not in await client.list_database_names()
        yield client[name]
    finally:
        try:
            await _drop_temporary_collections(client, name)
        finally:
            client.close()


async def _drop_temporary_collections(client: AsyncIOMotorClient, name: str) -> None:
    """Remove the temporary database by dropping its collections one by one.

    The Atlas application user has readWrite (which includes dropCollection)
    but intentionally not dropDatabase. MongoDB discards a database once its
    last collection is gone, so this leaves nothing behind.
    """
    assert name.startswith(TEMP_DB_PREFIX)
    db = client[name]
    for collection in await db.list_collection_names():
        if not collection.startswith("system."):
            await db.drop_collection(collection)


class Live:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.projects = ProjectRepository(db)
        self.learning = LearningRepository(db)
        self.project_service = ProjectService(self.projects, self.learning, _UnusedActivityRepository())  # type: ignore[arg-type]
        self.generation = GenerationService(
            self.projects, self.learning, DeterministicProvider(), timeout_seconds=30
        )
        self.learning_service = LearningService(self.projects, self.learning, ActivityService(None))  # type: ignore[arg-type]

    async def create(self) -> str:
        project, _ = await self.project_service.create_project(
            USER, ProjectCreateRequest(title="Live Test", description="temporary", platforms=["web"])
        )
        return project.id

    async def doc(self, project_id: str) -> dict[str, Any]:
        doc = await self.projects.get_by_id_for_user(project_id, USER)
        assert doc is not None
        return doc

    async def topic_versions(self, project_id: str) -> set[int]:
        cursor = self.db.learning_topics.find({"project_id": project_id})
        return {topic["curriculum_version"] async for topic in cursor}

    async def expire_lease(self, project_id: str) -> None:
        started = datetime.now(timezone.utc) - GENERATION_LEASE - timedelta(seconds=5)
        await self.projects.update(project_id, USER, {"generation.started_at": started.isoformat()})


@pytest.mark.asyncio
async def test_concurrent_retry_claims_succeed_exactly_once() -> None:
    async with _temporary_database() as db:
        live = Live(db)
        project_id = await live.create()
        await live.projects.finalize_generation(project_id, USER, 1, {"status": "failed"})

        results = await asyncio.gather(
            *(live.generation.claim_retry(USER, project_id) for _ in range(8)),
            return_exceptions=True,
        )

        claims = [result for result in results if not isinstance(result, BaseException)]
        conflicts = [result for result in results if isinstance(result, GenerationConflictError)]
        assert len(claims) == 1
        assert len(conflicts) == 7
        assert (await live.doc(project_id))["generation"]["attempt"] == 2


@pytest.mark.asyncio
async def test_superseded_attempt_cannot_finalize() -> None:
    async with _temporary_database() as db:
        live = Live(db)
        project_id = await live.create()
        await live.expire_lease(project_id)
        _, current = await live.generation.claim_retry(USER, project_id)
        # The first worker stalled past its lease; it finishes after the retry claimed.
        stale = GenerationClaim(user_id=USER, project_id=project_id, attempt=1, trigger="create")

        await live.generation.run(stale)

        doc = await live.doc(project_id)
        assert doc["status"] == "generating"
        assert doc["curriculum"] is None
        assert await live.topic_versions(project_id) == set()

        await live.generation.run(current)

        doc = await live.doc(project_id)
        assert doc["status"] == "ready"
        assert doc["curriculum"]["version"] == current.attempt == 2
        assert await live.topic_versions(project_id) == {2}
        learning = await live.learning_service.get_project_learning(USER, project_id)
        assert learning.topics


@pytest.mark.asyncio
async def test_expired_lease_reads_failed_and_is_retryable() -> None:
    async with _temporary_database() as db:
        live = Live(db)
        project_id = await live.create()

        with pytest.raises(GenerationConflictError):
            await live.generation.claim_retry(USER, project_id)

        await live.expire_lease(project_id)
        assert (await live.project_service.get_project(USER, project_id)).status == "failed"

        project, claim = await live.generation.claim_retry(USER, project_id)
        assert project.status == "generating"
        assert claim.attempt == 2


@pytest.mark.asyncio
async def test_legacy_migration_is_idempotent() -> None:
    async with _temporary_database() as db:
        live = Live(db)
        created_at = "2026-09-01T10:00:00+00:00"
        for project_id in ("with-topics", "without-topics"):
            await db.projects.insert_one(
                {
                    "id": project_id,
                    "user_id": USER,
                    "name": "Legacy",
                    "description": "d",
                    "platforms": ["web"],
                    "tech_stack": None,
                    "status": "preparing",
                    "progress": 0,
                    "icon_key": None,
                    "created_at": created_at,
                    "updated_at": created_at,
                }
            )
        content = {"what": "w", "why": "y", "how": "h", "example": "e", "apply": "a", "miniTask": None}
        await db.learning_topics.insert_many(
            [
                {"id": topic_id, "project_id": "with-topics", "title": topic_id, "description": "d",
                 "order": order, "content": content, "created_at": created_at}
                for order, topic_id in enumerate(("architecture-planning", "deployment"), start=1)
            ]
        )

        first = await migrate_generation_lifecycle(live.projects, live.learning)
        snapshot = (
            copy.deepcopy([doc async for doc in db.projects.find().sort("id", 1)]),
            copy.deepcopy([doc async for doc in db.learning_topics.find().sort("id", 1)]),
        )
        second = await migrate_generation_lifecycle(live.projects, live.learning)

        assert first == MigrationReport(ready=1, failed=1)
        assert second == MigrationReport()
        assert (
            [doc async for doc in db.projects.find().sort("id", 1)],
            [doc async for doc in db.learning_topics.find().sort("id", 1)],
        ) == snapshot
        assert await db.learning_topics.count_documents({}) == 2
        assert (await live.doc("with-topics"))["status"] == "ready"
        assert (await live.doc("without-topics"))["status"] == "failed"
        assert await live.topic_versions("with-topics") == {1}
