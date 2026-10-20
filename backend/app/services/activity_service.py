"""The activity layer and the Momentum/Streak state derived from it.

A *completion* is the learning record itself (`learning_progress`). An
*activity* is the qualifying engagement a completion produces. They are kept
separate so future activity types (tasks, milestones) can feed the same streak
without changing how streaks are calculated.
"""

from datetime import datetime, timezone
from typing import Any

from app.repositories.activity_repository import ActivityRepository
from app.schemas.activity import ActivityEvent, MomentumState, WeekDay, WeeklyTotals
from app.utils.streak import (
    WEEK_LABELS,
    activity_day,
    current_streak,
    last_seven_days,
    resolve_timezone,
    week_dates,
)

#: How many events the Progress screen lists. Matches RECENT_ACTIVITY_LIMIT in
#: features/progress/hooks/useProgressOverview.ts.
RECENT_ACTIVITY_LIMIT = 6

#: Upper bound on the activity read backing one Momentum response. Events are
#: newest-first, so the current streak is always fully covered; only
#: `totalActiveDays` would under-report beyond this many events.
MOMENTUM_EVENT_LIMIT = 500

#: Activity type -> the WeeklyTotals field it counts towards.
_WEEKLY_TOTAL_FIELDS = {"task": "tasks", "learning": "topics", "milestone": "milestones"}


def learning_activity_id(project_id: str, topic_id: str) -> str:
    """The stable identity of the activity a topic completion produces.

    Deterministic on purpose: it is the idempotency key. Completing the same
    topic again resolves to the same id and so cannot add a second qualifying
    activity, no matter how many times the request is retried.
    """

    return f"learning:{project_id}:{topic_id}"


class ActivityService:
    def __init__(self, activity_repo: ActivityRepository) -> None:
        self._activity = activity_repo

    async def record_learning_completion(
        self,
        *,
        user_id: str,
        project_id: str,
        project_name: str,
        topic_id: str,
        topic_title: str,
        occurred_at: str,
    ) -> bool:
        """Record the qualifying activity for one topic completion.

        Safe to call repeatedly for the same completion. Returns True only
        when this call actually created the activity.
        """

        return await self._activity.record(
            {
                "id": learning_activity_id(project_id, topic_id),
                "user_id": user_id,
                "type": "learning",
                "description": f"Finished {topic_title} learning topic",
                "project_id": project_id,
                "project_name": project_name,
                "occurred_at": occurred_at,
            }
        )

    async def get_momentum(
        self, user_id: str, timezone_name: str, now: datetime | None = None
    ) -> MomentumState:
        """The authoritative Momentum/Streak state for one user.

        `now` is injectable so streak behaviour can be tested against fixed
        instants instead of the machine clock. Raises UnknownTimezoneError for
        an unrecognised IANA name.
        """

        tz = resolve_timezone(timezone_name)
        instant = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        today = instant.astimezone(tz).date()

        # Ownership: the repository only ever returns this user's events, so
        # another user's activity can never reach the calculation below.
        docs = await self._activity.list_for_user(user_id, limit=MOMENTUM_EVENT_LIMIT)
        dated = [(doc, activity_day(doc["occurred_at"], tz)) for doc in docs]

        # Collapsing to a set is what makes several completions on one
        # calendar day count as a single active day.
        days = {day for _, day in dated}
        last_day = max(days) if days else None

        window = last_seven_days(today)
        totals = {"tasks": 0, "topics": 0, "milestones": 0}
        for doc, day in dated:
            field = _WEEKLY_TOTAL_FIELDS.get(doc["type"])
            if field and day in window:
                totals[field] += 1

        recent = sorted(docs, key=lambda doc: doc["occurred_at"], reverse=True)

        return MomentumState(
            streakDays=current_streak(days, today),
            isActiveToday=today in days,
            lastActivityDay=last_day.isoformat() if last_day else None,
            totalActiveDays=len(days),
            timezone=timezone_name,
            week=[
                WeekDay(label=label, active=day in days, isToday=day == today)
                for label, day in zip(WEEK_LABELS, week_dates(today))
            ],
            weekly=WeeklyTotals(**totals),
            recentActivity=[_event_from_doc(doc) for doc in recent[:RECENT_ACTIVITY_LIMIT]],
        )


def _event_from_doc(doc: dict[str, Any]) -> ActivityEvent:
    return ActivityEvent(
        id=doc["id"],
        type=doc["type"],
        description=doc["description"],
        projectId=doc.get("project_id"),
        projectName=doc.get("project_name"),
        occurredAt=doc["occurred_at"],
    )
