"""Phase 3.2 — activity, momentum and streak.

Streak behaviour is exercised against the service with an injected `now` and
hand-seeded UTC timestamps, never the machine clock. The route-level tests
cover wiring and idempotency, which are clock-independent.
"""

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.services.activity_service import ActivityService, learning_activity_id
from app.utils.streak import UnknownTimezoneError

KOLKATA = "Asia/Kolkata"
LOS_ANGELES = "America/Los_Angeles"

# Mid-March, well clear of any DST transition in the zones used below.
NOW_UTC = datetime(2026, 3, 15, 10, 0, tzinfo=timezone.utc)


def _at(day: int, hour: int = 12, minute: int = 0) -> str:
    """A UTC timestamp in March 2026, stored exactly as the app stores them."""

    return datetime(2026, 3, day, hour, minute, tzinfo=timezone.utc).isoformat()


def _seed(
    repo: Any,
    occurred_at: str,
    *,
    user_id: str = "user-a",
    activity_id: str | None = None,
    activity_type: str = "learning",
) -> None:
    repo.events.append(
        {
            "id": activity_id or f"learning:p1:t{len(repo.events)}",
            "user_id": user_id,
            "type": activity_type,
            "description": "Finished a learning topic",
            "project_id": "p1",
            "project_name": "Demo",
            "occurred_at": occurred_at,
        }
    )


@pytest.fixture()
def service(repos: dict[str, object]) -> ActivityService:
    return ActivityService(repos["activity"])


def _create_project(client: TestClient, **overrides: object) -> dict:
    payload = {"title": "App", "description": "mobile app", "platforms": ["android"]}
    payload.update(overrides)
    return client.post("/api/v1/projects", json=payload).json()["data"]


def _first_topic_id(client: TestClient, project_id: str) -> str:
    return client.get(f"/api/v1/projects/{project_id}/learning").json()["data"]["topics"][0]["id"]


# --- 1-2. Completion produces exactly one qualifying activity -----------------


def test_completing_a_topic_creates_one_qualifying_activity(
    client: TestClient, repos: dict[str, object]
) -> None:
    project = _create_project(client)
    topic_id = _first_topic_id(client, project["id"])

    completed = client.post(
        f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete"
    ).json()["data"]

    events = repos["activity"].events
    assert len(events) == 1
    assert events[0]["id"] == learning_activity_id(project["id"], topic_id)
    assert events[0]["type"] == "learning"
    assert events[0]["user_id"] == "user-a"
    # The activity is timestamped from the completion, not from a second clock read.
    assert events[0]["occurred_at"] == completed["completedAt"]


def test_repeating_the_same_completion_creates_no_duplicate_activity(
    client: TestClient, repos: dict[str, object]
) -> None:
    project = _create_project(client)
    topic_id = _first_topic_id(client, project["id"])
    path = f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete"

    first = client.post(path).json()["data"]
    for _ in range(4):
        repeated = client.post(path).json()["data"]

    assert repeated["completedAt"] == first["completedAt"]
    assert len(repos["activity"].events) == 1


def test_a_missing_activity_is_repaired_by_retrying_the_completion(
    client: TestClient, repos: dict[str, object]
) -> None:
    """A completion whose activity write failed must not stay stranded behind
    an already-completed topic."""

    project = _create_project(client)
    topic_id = _first_topic_id(client, project["id"])
    path = f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete"

    completed = client.post(path).json()["data"]
    repos["activity"].events.clear()  # simulate the activity write having failed

    client.post(path)

    events = repos["activity"].events
    assert len(events) == 1
    assert events[0]["occurred_at"] == completed["completedAt"]


# --- 3. Several completions on one calendar day count once --------------------


@pytest.mark.asyncio
async def test_many_completions_on_one_day_count_as_one_active_day(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for hour in (7, 9, 11, 15, 21):
        _seed(repos["activity"], _at(15, hour))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.totalActiveDays == 1
    assert momentum.streakDays == 1
    assert momentum.isActiveToday is True
    # All five are still individually real activities.
    assert momentum.weekly.topics == 5


# --- 4-6. Streak over consecutive, missed and resumed days --------------------


@pytest.mark.asyncio
async def test_consecutive_active_days_produce_the_expected_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for day in (13, 14, 15):
        _seed(repos["activity"], _at(day))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 3
    assert momentum.totalActiveDays == 3
    assert momentum.lastActivityDay == "2026-03-15"


@pytest.mark.asyncio
async def test_a_missed_calendar_day_breaks_the_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for day in (11, 12, 14, 15):  # 13th missed
        _seed(repos["activity"], _at(day))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 2
    assert momentum.totalActiveDays == 4


@pytest.mark.asyncio
async def test_activity_after_a_missed_day_starts_a_new_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    _seed(repos["activity"], _at(10))
    _seed(repos["activity"], _at(15))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 1


@pytest.mark.asyncio
async def test_no_activity_yet_today_keeps_yesterdays_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for day in (13, 14):
        _seed(repos["activity"], _at(day))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 2
    assert momentum.isActiveToday is False
    assert momentum.lastActivityDay == "2026-03-14"


@pytest.mark.asyncio
async def test_two_idle_days_end_the_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for day in (12, 13):
        _seed(repos["activity"], _at(day))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 0
    assert momentum.isActiveToday is False


@pytest.mark.asyncio
async def test_no_activity_at_all_is_an_empty_streak(service: ActivityService) -> None:
    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 0
    assert momentum.totalActiveDays == 0
    assert momentum.lastActivityDay is None
    assert momentum.recentActivity == []


# --- 7. Ownership -------------------------------------------------------------


@pytest.mark.asyncio
async def test_another_users_activity_cannot_affect_this_users_streak(
    service: ActivityService, repos: dict[str, object]
) -> None:
    _seed(repos["activity"], _at(15), user_id="user-a")
    for day in (11, 12, 13, 14):
        _seed(repos["activity"], _at(day), user_id="user-b")

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.streakDays == 1
    assert momentum.totalActiveDays == 1
    assert all(event.projectId == "p1" for event in momentum.recentActivity)
    assert len(momentum.recentActivity) == 1


def test_momentum_endpoint_is_scoped_to_the_authenticated_user(client: TestClient) -> None:
    project = _create_project(client)
    topic_id = _first_topic_id(client, project["id"])
    client.post(f"/api/v1/projects/{project['id']}/learning/{topic_id}/complete")

    other = client.get("/api/v1/momentum", headers={"x-test-user-id": "user-b"}).json()["data"]

    assert other["streakDays"] == 0
    assert other["totalActiveDays"] == 0
    assert other["recentActivity"] == []


# --- 8-9. Timezone boundaries and UTC -> IANA conversion ----------------------


@pytest.mark.asyncio
async def test_utc_timestamps_are_bucketed_by_the_users_ahead_of_utc_zone(
    service: ActivityService, repos: dict[str, object]
) -> None:
    """Asia/Kolkata is UTC+5:30, so 18:30Z is the day boundary."""

    _seed(repos["activity"], _at(15, 18, 0))  # 23:30 on the 15th in Kolkata
    _seed(repos["activity"], _at(15, 19, 0))  # 00:30 on the 16th in Kolkata

    # 10:30 on the 16th in Kolkata; still the 16th in UTC.
    now = datetime(2026, 3, 16, 5, 0, tzinfo=timezone.utc)

    in_kolkata = await service.get_momentum("user-a", KOLKATA, now=now)
    in_utc = await service.get_momentum("user-a", "UTC", now=now)

    assert in_kolkata.totalActiveDays == 2
    assert in_kolkata.lastActivityDay == "2026-03-16"
    assert in_kolkata.isActiveToday is True
    assert in_kolkata.streakDays == 2

    # The same stored events are a single day in UTC, with nothing yet today.
    assert in_utc.totalActiveDays == 1
    assert in_utc.lastActivityDay == "2026-03-15"
    assert in_utc.isActiveToday is False
    assert in_utc.streakDays == 1


@pytest.mark.asyncio
async def test_utc_timestamps_are_bucketed_by_the_users_behind_utc_zone(
    service: ActivityService, repos: dict[str, object]
) -> None:
    """America/Los_Angeles is behind UTC, so an early-UTC event is the previous day."""

    _seed(repos["activity"], _at(15, 3, 0))  # 20:00 on the 14th in Los Angeles

    now = datetime(2026, 3, 15, 20, 0, tzinfo=timezone.utc)  # 13:00 on the 15th in LA
    momentum = await service.get_momentum("user-a", LOS_ANGELES, now=now)

    assert momentum.lastActivityDay == "2026-03-14"
    assert momentum.isActiveToday is False
    assert momentum.streakDays == 1  # yesterday in LA, so the streak stands


@pytest.mark.asyncio
async def test_a_streak_can_differ_between_two_users_in_different_zones(
    service: ActivityService, repos: dict[str, object]
) -> None:
    """The zone is per request, never a server-wide default."""

    _seed(repos["activity"], _at(14, 19, 0), user_id="user-a")  # 15th in Kolkata
    _seed(repos["activity"], _at(15, 19, 0), user_id="user-a")  # 16th in Kolkata

    now = datetime(2026, 3, 16, 5, 0, tzinfo=timezone.utc)
    assert (await service.get_momentum("user-a", KOLKATA, now=now)).streakDays == 2
    assert (await service.get_momentum("user-a", "UTC", now=now)).streakDays == 2
    assert (await service.get_momentum("user-a", LOS_ANGELES, now=now)).streakDays == 2


@pytest.mark.asyncio
async def test_an_unknown_timezone_is_rejected_rather_than_defaulting(
    service: ActivityService,
) -> None:
    with pytest.raises(UnknownTimezoneError):
        await service.get_momentum("user-a", "Mars/Olympus", now=NOW_UTC)


def test_momentum_endpoint_rejects_an_unknown_timezone(client: TestClient) -> None:
    response = client.get("/api/v1/momentum", params={"timezone": "Mars/Olympus"})

    assert response.status_code == 422


def test_momentum_endpoint_accepts_an_iana_timezone(client: TestClient) -> None:
    response = client.get("/api/v1/momentum", params={"timezone": KOLKATA})

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["timezone"] == KOLKATA


# --- Week strip and weekly totals the UI renders ------------------------------


@pytest.mark.asyncio
async def test_week_strip_marks_active_days_monday_to_sunday(
    service: ActivityService, repos: dict[str, object]
) -> None:
    # 2026-03-15 is a Sunday; its week runs Mon 9th to Sun 15th.
    for day in (9, 11, 15):
        _seed(repos["activity"], _at(day))

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert [day.label for day in momentum.week] == [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ]
    assert [day.active for day in momentum.week] == [True, False, True, False, False, False, True]
    assert [day.isToday for day in momentum.week] == [False] * 6 + [True]


@pytest.mark.asyncio
async def test_weekly_totals_count_only_the_last_seven_days_by_type(
    service: ActivityService, repos: dict[str, object]
) -> None:
    _seed(repos["activity"], _at(15), activity_type="learning")
    _seed(repos["activity"], _at(14), activity_type="task")
    _seed(repos["activity"], _at(9), activity_type="milestone")
    _seed(repos["activity"], _at(1), activity_type="learning")  # outside the window

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    assert momentum.weekly.topics == 1
    assert momentum.weekly.tasks == 1
    assert momentum.weekly.milestones == 1


@pytest.mark.asyncio
async def test_recent_activity_is_newest_first_and_capped(
    service: ActivityService, repos: dict[str, object]
) -> None:
    for day in range(1, 16):
        _seed(repos["activity"], _at(day), activity_id=f"learning:p1:t{day}")

    momentum = await service.get_momentum("user-a", "UTC", now=NOW_UTC)

    occurred = [event.occurredAt for event in momentum.recentActivity]
    assert len(occurred) == 6
    assert occurred == sorted(occurred, reverse=True)
    assert momentum.recentActivity[0].occurredAt == _at(15)
