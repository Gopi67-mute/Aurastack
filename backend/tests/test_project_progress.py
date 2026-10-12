"""Server-authoritative project progress, and first-write-wins topic completion."""

import asyncio
import itertools
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services import learning_service as learning_service_module
from app.services.activity_service import ActivityService
from app.services.learning_service import LearningService
from app.services.project_service import GENERATION_LEASE, ProjectService
from app.utils.learning_progress import learning_percent
from tests.fakes import (
    FakeActivityRepository,
    FakeBlueprintRepository,
    FakeLearningRepository,
    FakeProjectRepository,
)

USER = "user-a"
OTHER_USER = "user-b"
CONTENT = {"what": "w", "why": "y", "how": "h", "example": "e", "apply": "a", "miniTask": None}


class Store:
    def __init__(self, learning: Any = None) -> None:
        self.projects = FakeProjectRepository()
        self.learning = learning or FakeLearningRepository()
        self.activity = FakeActivityRepository()
        self.project_service = ProjectService(
            self.projects, self.learning, self.activity, FakeBlueprintRepository()
        )
        self.learning_service = LearningService(
            self.projects, self.learning, ActivityService(self.activity)
        )

    async def project(
        self,
        project_id: str,
        *,
        user_id: str = USER,
        status: str = "ready",
        version: int | None = 1,
        topics: int = 4,
        stored_progress: int = 0,
        started_at: str | None = None,
    ) -> list[str]:
        """A project whose active curriculum `version` has `topics` topics. Returns their ids."""

        now = datetime.now(timezone.utc).isoformat()
        await self.projects.insert(
            {
                "id": project_id,
                "user_id": user_id,
                "name": project_id,
                "description": "d",
                "platforms": ["web"],
                "tech_stack": None,
                "status": status,
                # Legacy stored value: must never be reported.
                "progress": stored_progress,
                "icon_key": None,
                "generation": {"attempt": version or 1, "started_at": started_at or now},
                "curriculum": None if version is None else {"version": version},
                "created_at": now,
                "updated_at": now,
            }
        )
        return [] if version is None else await self.topics(project_id, version, topics)

    async def topics(self, project_id: str, version: int, count: int) -> list[str]:
        ids = [f"{project_id}-v{version}-t{order}" for order in range(1, count + 1)]
        await self.learning.insert_topics(
            [
                {
                    "id": topic_id,
                    "project_id": project_id,
                    "curriculum_version": version,
                    "title": topic_id,
                    "description": "d",
                    "order": order,
                    "content": CONTENT,
                    "created_at": "2026-10-01T00:00:00+00:00",
                }
                for order, topic_id in enumerate(ids, start=1)
            ]
        )
        return ids

    async def complete(self, project_id: str, topic_ids: list[str], user_id: str = USER) -> None:
        for topic_id in topic_ids:
            await self.learning.complete_progress(
                user_id, project_id, topic_id, "2026-10-02T00:00:00+00:00"
            )

    async def progress(self, project_id: str) -> int:
        listed = {
            project.id: project.progress for project in await self.project_service.list_projects(USER)
        }
        single = (await self.project_service.get_project(USER, project_id)).progress
        # The list and the single read must always agree.
        assert listed[project_id] == single
        return single


# --- learning_percent ---------------------------------------------------------


@pytest.mark.parametrize(
    ("completed", "total", "expected"),
    [
        (0, 0, 0),
        (0, 5, 0),
        (1, 3, 33),
        (2, 3, 67),
        (1, 8, 13),  # 12.5 rounds half up, as Math.round does on the client.
        (3, 8, 38),  # 37.5
        (1, 200, 1),  # 0.5
        (5, 5, 100),
    ],
)
def test_learning_percent_matches_the_client_rounding(completed: int, total: int, expected: int) -> None:
    assert learning_percent(completed, total) == expected


# --- project progress ---------------------------------------------------------


@pytest.mark.asyncio
async def test_no_completed_topics_is_zero_percent() -> None:
    store = Store()
    await store.project("p1", topics=4, stored_progress=72)

    assert await store.progress("p1") == 0


@pytest.mark.asyncio
async def test_some_completed_topics_is_the_rounded_percentage() -> None:
    store = Store()
    topic_ids = await store.project("p1", topics=8)
    await store.complete("p1", topic_ids[:1])

    assert await store.progress("p1") == 13

    await store.complete("p1", topic_ids[1:3])

    assert await store.progress("p1") == 38


@pytest.mark.asyncio
async def test_all_topics_completed_is_one_hundred_percent() -> None:
    store = Store()
    topic_ids = await store.project("p1", topics=3)
    await store.complete("p1", topic_ids)

    assert await store.progress("p1") == 100


@pytest.mark.asyncio
async def test_generating_project_is_zero_percent() -> None:
    store = Store()
    await store.project("p1", status="generating", version=None, stored_progress=40)

    assert await store.progress("p1") == 0


@pytest.mark.asyncio
async def test_failed_project_is_zero_percent() -> None:
    store = Store()
    await store.project("failed", status="failed", version=None, stored_progress=60)
    stalled_since = (datetime.now(timezone.utc) - GENERATION_LEASE - timedelta(seconds=5)).isoformat()
    await store.project(
        "stalled", status="generating", version=None, stored_progress=60, started_at=stalled_since
    )

    assert await store.progress("failed") == 0
    assert (await store.project_service.get_project(USER, "stalled")).status == "failed"
    assert await store.progress("stalled") == 0


@pytest.mark.asyncio
async def test_project_without_curriculum_is_zero_percent() -> None:
    store = Store()
    await store.project("p1", status="ready", version=None, stored_progress=50)

    assert await store.progress("p1") == 0


@pytest.mark.asyncio
async def test_topics_of_older_curriculum_versions_are_ignored() -> None:
    store = Store()
    active = await store.project("p1", version=2, topics=4)
    superseded = await store.topics("p1", version=1, count=6)
    await store.complete("p1", superseded)
    await store.complete("p1", active[:1])

    # 1 of the active version's 4 topics: neither the old topics nor their
    # completions count.
    assert await store.progress("p1") == 25


@pytest.mark.asyncio
async def test_another_users_completions_are_ignored() -> None:
    store = Store()
    topic_ids = await store.project("p1", topics=4)
    await store.complete("p1", topic_ids, user_id=OTHER_USER)

    assert await store.progress("p1") == 0


@pytest.mark.asyncio
async def test_another_projects_completions_are_ignored() -> None:
    store = Store()
    topic_ids = await store.project("p1", topics=4)
    await store.project("p2", topics=4)
    # Same topic ids recorded against a different project.
    await store.complete("p2", topic_ids)

    assert await store.progress("p1") == 0
    assert await store.progress("p2") == 0


class CountingLearningRepository:
    """Records each repository method the services call; every call is one query."""

    def __init__(self) -> None:
        self._inner = FakeLearningRepository()
        self.calls: list[str] = []

    def __getattr__(self, name: str) -> Any:
        attribute = getattr(self._inner, name)
        if callable(attribute):
            self.calls.append(name)
        return attribute


@pytest.mark.asyncio
async def test_listing_projects_reads_progress_in_a_fixed_number_of_batched_queries() -> None:
    learning = CountingLearningRepository()
    store = Store(learning)
    for index in range(5):
        topic_ids = await store.project(f"ready-{index}", topics=4)
        await store.complete(f"ready-{index}", topic_ids[:index])
    await store.project("generating", status="generating", version=None)
    learning.calls.clear()

    projects = await store.project_service.list_projects(USER)

    assert len(projects) == 6
    assert learning.calls == ["list_topic_ids_for_projects", "list_progress_for_projects"]
    by_id = {project.id: project.progress for project in projects}
    assert [by_id[f"ready-{index}"] for index in range(5)] == [0, 25, 50, 75, 100]
    assert by_id["generating"] == 0


@pytest.mark.asyncio
async def test_progress_is_never_written_back() -> None:
    store = Store()
    topic_ids = await store.project("p1", topics=2, stored_progress=7)
    await store.complete("p1", topic_ids[:1])

    assert await store.progress("p1") == 50
    assert (await store.projects.get_by_id_for_user("p1", USER))["progress"] == 7


def test_api_reports_progress_after_completing_a_topic(client: TestClient) -> None:
    project_id = client.post(
        "/api/v1/projects", json={"title": "A", "description": "mobile app", "platforms": ["android"]}
    ).json()["data"]["id"]
    topics = client.get(f"/api/v1/projects/{project_id}/learning").json()["data"]["topics"]

    client.post(f"/api/v1/projects/{project_id}/learning/{topics[0]['id']}/complete")

    expected = learning_percent(1, len(topics))
    assert expected > 0
    assert client.get(f"/api/v1/projects/{project_id}").json()["data"]["progress"] == expected
    assert client.get("/api/v1/projects").json()["data"][0]["progress"] == expected
    assert (
        client.get("/api/v1/projects", headers={"x-test-user-id": OTHER_USER}).json()["data"] == []
    )


# --- first-write-wins completion ---------------------------------------------


class InterleavingLearningRepository(FakeLearningRepository):
    """Yields to the event loop before every read and write, so concurrent
    requests interleave between them the way they can against MongoDB."""

    async def get_topic(self, *args: Any) -> dict[str, Any] | None:
        await asyncio.sleep(0)
        return await super().get_topic(*args)

    async def get_progress(self, *args: Any) -> dict[str, Any] | None:
        await asyncio.sleep(0)
        return await super().get_progress(*args)

    async def complete_progress(self, *args: Any) -> str:
        await asyncio.sleep(0)
        return await super().complete_progress(*args)


class _TickingClock(datetime):
    """Every call to now() is one second later than the previous one."""

    _ticks = itertools.count()

    @classmethod
    def now(cls, tz: Any = None) -> "_TickingClock":  # type: ignore[override]
        start = cls(2026, 10, 6, 9, 0, tzinfo=timezone.utc)
        return start + timedelta(seconds=next(cls._ticks))


@pytest.mark.asyncio
async def test_concurrent_completions_keep_the_first_completed_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(learning_service_module, "datetime", _TickingClock)
    store = Store(InterleavingLearningRepository())
    topic_id = (await store.project("p1", topics=2))[0]

    results = await asyncio.gather(
        *(store.learning_service.complete_topic(USER, "p1", topic_id) for _ in range(5))
    )

    stored = (await store.learning.get_progress(USER, "p1", topic_id))["completed_at"]
    assert {result.completedAt for result in results} == {stored}
    assert [event["occurred_at"] for event in store.activity.events] == [stored]

    # A later completion still keeps the first timestamp.
    again = await store.learning_service.complete_topic(USER, "p1", topic_id)
    assert again.completedAt == stored
    assert len(store.activity.events) == 1
