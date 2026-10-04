"""Calendar-day and streak arithmetic.

Pure helpers, deliberately free of MongoDB and FastAPI so the streak rules can
be tested directly with fixed dates.

The single rule everything here follows:

    UTC timestamp + the user's IANA timezone = the activity's calendar day

Activity days are never stored; they are derived on every read. Storing a day
would freeze whichever zone was in effect when the activity was written and
could then disagree with `occurred_at`.
"""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DAYS_PER_WEEK = 7

#: Monday-first, matching features/progress/utils/progressStats.ts.
WEEK_LABELS: tuple[str, ...] = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


class UnknownTimezoneError(Exception):
    """The caller supplied something that is not a known IANA timezone."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Unknown timezone: {name}")
        self.name = name


def resolve_timezone(name: str) -> ZoneInfo:
    """Resolve an IANA name such as `Asia/Kolkata`.

    Raises UnknownTimezoneError for anything unrecognised, so a bad client
    value surfaces as a validation error instead of silently falling back to
    UTC and reporting the wrong streak.
    """

    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise UnknownTimezoneError(name) from exc


def parse_utc(value: str) -> datetime:
    """Parse a stored ISO 8601 timestamp as an aware UTC datetime.

    A value without an offset is treated as UTC rather than as server-local
    time, which is what every timestamp this project writes actually is.
    """

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def activity_day(occurred_at: str, tz: ZoneInfo) -> date:
    """The calendar day a UTC timestamp falls on in the user's timezone."""

    return parse_utc(occurred_at).astimezone(tz).date()


def current_streak(days: set[date], today: date) -> int:
    """Consecutive active calendar days ending today, or yesterday.

    A day with no activity *yet today* does not break the streak: counting
    starts from yesterday instead. Two days without activity ends it at 0.
    """

    cursor = today if today in days else today - timedelta(days=1)

    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def week_dates(today: date) -> list[date]:
    """The Monday-to-Sunday week containing `today`."""

    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=offset) for offset in range(DAYS_PER_WEEK)]


def last_seven_days(today: date) -> set[date]:
    """The rolling 7-day window ending today, inclusive."""

    return {today - timedelta(days=offset) for offset in range(DAYS_PER_WEEK)}
