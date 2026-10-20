from typing import Literal, Optional

from pydantic import BaseModel

ActivityType = Literal["task", "learning", "milestone"]


class ActivityEvent(BaseModel):
    """Mirrors features/progress/types/progress.ts::ActivityEvent exactly."""

    id: str
    type: ActivityType
    description: str
    projectId: Optional[str] = None
    projectName: Optional[str] = None
    occurredAt: str


class WeekDay(BaseModel):
    """Mirrors features/progress/types/progress.ts::WeekDay exactly."""

    label: str
    active: bool
    isToday: bool


class WeeklyTotals(BaseModel):
    """Mirrors features/progress/types/progress.ts::WeeklyTotals exactly."""

    tasks: int
    topics: int
    milestones: int


class MomentumState(BaseModel):
    """The authoritative Momentum/Streak state for one user.

    Carries everything the Progress and Home screens render, so the client
    never re-derives calendar days or streak rules of its own.
    """

    streakDays: int
    #: Whether a qualifying activity already happened today in `timezone`.
    isActiveToday: bool
    #: Most recent active calendar day as YYYY-MM-DD, in `timezone`.
    lastActivityDay: Optional[str] = None
    totalActiveDays: int
    #: The IANA timezone every day in this response was resolved against.
    timezone: str
    week: list[WeekDay]
    weekly: WeeklyTotals
    recentActivity: list[ActivityEvent]
