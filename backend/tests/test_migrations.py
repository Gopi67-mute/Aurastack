"""Phase 3.3 startup migration of Phase 3.2 projects onto the generation lifecycle."""

import copy
from typing import Any

import pytest

from app.db.migrations import MigrationReport, migrate_generation_lifecycle
from app.services.activity_service import ActivityService, learning_activity_id
from app.services.generation_service import FAILURE_LEGACY_MISSING_CURRICULUM
from app.services.learning_service import LearningService
from app.services.project_service import project_from_doc
from tests.fakes import FakeActivityRepository, FakeLearningRepository, FakeProjectRepository

USER = "user-a"
CREATED_AT = "2026-09-01T10:00:00+00:00"
CONTENT = {"what": "w", "why": "y", "how": "h", "example": "e", "apply": "a", "miniTask": None}


def _legacy_project(project_id: str, status: str = "preparing") -> dict[str, Any]:
    """A project document exactly as Phase 3.2 wrote it."""

    return {
        "id": project_id,
        "user_id": USER,
        "name": "Legacy",
        "description": "d",
        "platforms": ["web"],
        "tech_stack": None,
        "status": status,
        "progress": 0,
        "icon_key": None,
        "created_at": CREATED_AT,
        "updated_at": CREATED_AT,
    }


def _legacy_topic(project_id: str, topic_id: str, order: int) -> dict[str, Any]:
    return {
        "id": topic_id,
        "project_id": project_id,
        "title": topic_id.replace("-", " ").title(),
        "description": "d",
        "order": order,
        "content": CONTENT,
        "created_at": CREATED_AT,
    }


@pytest.fixture()
def store() -> dict[str, Any]:
    return {
        "projects": FakeProjectRepository(),
        "learning": FakeLearningRepository(),
        "activity": FakeActivityRepository(),
    }


async def _seed_legacy(store: dict[str, Any]) -> None:
    """One project with a curriculum and a completion, one with no topics."""

    await store["projects"].insert(_legacy_project("with-topics"))
    await store["learning"].insert_topics(
        [
            _legacy_topic("with-topics", "architecture-planning", 1),
            _legacy_topic("with-topics", "deployment", 2),
        ]
    )
    await store["learning"].complete_progress(
        USER, "with-topics", "architecture-planning", "2026-09-02T08:00:00+00:00"
    )
    await ActivityService(store["activity"]).record_learning_completion(
        user_id=USER,
        project_id="with-topics",
        project_name="Legacy",
        topic_id="architecture-planning",
        topic_title="Architecture Planning",
        occurred_at="2026-09-02T08:00:00+00:00",
    )
    await store["projects"].insert(_legacy_project("without-topics"))


async def _migrate(store: dict[str, Any]) -> MigrationReport:
    return await migrate_generation_lifecycle(store["projects"], store["learning"])


@pytest.mark.asyncio
async def test_preparing_project_with_topics_becomes_ready_with_version_1(
    store: dict[str, Any],
) -> None:
    await _seed_legacy(store)

    await _migrate(store)

    doc = store["projects"]._docs["with-topics"]
    assert doc["status"] == "ready"
    assert doc["curriculum"] == {
        "version": 1,
        "schema_version": "1.0",
        "source": "deterministic",
        "model": None,
        "generated_at": CREATED_AT,
    }
    assert doc["generation"]["attempt"] == 1
    assert doc["generation"]["failure_reason"] is None
    assert {topic["curriculum_version"] for topic in store["learning"].all_topics("with-topics")} == {1}


@pytest.mark.asyncio
async def test_existing_topic_ids_are_preserved(store: dict[str, Any]) -> None:
    await _seed_legacy(store)
    before = [topic["id"] for topic in store["learning"].all_topics("with-topics")]

    await _migrate(store)

    after = [topic["id"] for topic in store["learning"].all_topics("with-topics")]
    assert after == before == ["architecture-planning", "deployment"]


@pytest.mark.asyncio
async def test_preparing_project_without_topics_becomes_retryable_failure(
    store: dict[str, Any],
) -> None:
    await _seed_legacy(store)

    await _migrate(store)

    doc = store["projects"]._docs["without-topics"]
    assert doc["status"] == "failed"
    assert doc["curriculum"] is None
    assert doc["generation"]["failure_reason"] == FAILURE_LEGACY_MISSING_CURRICULUM
    assert doc["generation"]["attempt"] == 0
    assert project_from_doc(doc).status == "failed"


@pytest.mark.asyncio
async def test_project_patched_to_ready_in_phase_3_2_is_migrated_too(
    store: dict[str, Any],
) -> None:
    # Phase 3.2 let clients PATCH status, so legacy "ready" docs exist.
    await store["projects"].insert(_legacy_project("patched", status="ready"))
    await store["learning"].insert_topics([_legacy_topic("patched", "deployment", 1)])

    await _migrate(store)

    assert store["projects"]._docs["patched"]["curriculum"]["version"] == 1


@pytest.mark.asyncio
async def test_migration_is_idempotent(store: dict[str, Any]) -> None:
    await _seed_legacy(store)

    first = await _migrate(store)
    snapshot = (
        copy.deepcopy(store["projects"]._docs),
        copy.deepcopy(store["learning"]._topics),
    )
    second = await _migrate(store)

    assert first == MigrationReport(ready=1, failed=1)
    assert second == MigrationReport(ready=0, failed=0)
    assert (store["projects"]._docs, store["learning"]._topics) == snapshot


@pytest.mark.asyncio
async def test_new_projects_are_left_alone(store: dict[str, Any]) -> None:
    current = _legacy_project("current", status="generating")
    current["curriculum"] = None
    current["generation"] = {"attempt": 1, "started_at": CREATED_AT, "completed_at": None, "failure_reason": None}
    await store["projects"].insert(current)
    snapshot = copy.deepcopy(current)

    assert await _migrate(store) == MigrationReport()
    assert store["projects"]._docs["current"] == snapshot


@pytest.mark.asyncio
async def test_progress_and_activity_are_unchanged(store: dict[str, Any]) -> None:
    await _seed_legacy(store)
    progress_before = copy.deepcopy(store["learning"]._progress)
    activity_before = copy.deepcopy(store["activity"].events)

    await _migrate(store)

    assert store["learning"]._progress == progress_before
    assert store["activity"].events == activity_before
    assert activity_before[0]["id"] == learning_activity_id("with-topics", "architecture-planning")


@pytest.mark.asyncio
async def test_migrated_completion_still_resolves_and_stays_idempotent(
    store: dict[str, Any],
) -> None:
    await _seed_legacy(store)
    await _migrate(store)
    learning = LearningService(
        store["projects"], store["learning"], ActivityService(store["activity"])
    )

    project = await learning.get_project_learning(USER, "with-topics")
    completed = [topic for topic in project.topics if topic.status == "completed"]
    assert [topic.id for topic in completed] == ["architecture-planning"]

    # Re-completing resolves to the same activity identity: no second event.
    again = await learning.complete_topic(USER, "with-topics", "architecture-planning")
    assert again.completedAt == "2026-09-02T08:00:00+00:00"
    assert len(store["activity"].events) == 1
