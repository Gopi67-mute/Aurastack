import type { ActivityEvent, WeekDay, WeeklyTotals } from "../types/progress";

const DAYS_PER_WEEK = 7;
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function activeDayKeys(events: readonly ActivityEvent[]): Set<string> {
  return new Set(events.map((event) => dayKey(new Date(event.occurredAt))));
}

/**
 * Consecutive days with activity. A day without activity yet today does not
 * break the streak; it counts back from yesterday instead.
 */
export function getStreakDays(events: readonly ActivityEvent[], now: Date = new Date()): number {
  const active = activeDayKeys(events);
  let cursor = startOfDay(now);
  if (!active.has(dayKey(cursor))) cursor = shiftDays(cursor, -1);

  let streak = 0;
  while (active.has(dayKey(cursor))) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

/** Monday-to-Sunday view of the current week. Days not yet reached are inactive. */
export function getWeekDays(events: readonly ActivityEvent[], now: Date = new Date()): WeekDay[] {
  const active = activeDayKeys(events);
  const today = startOfDay(now);
  const mondayOffset = (today.getDay() + 6) % DAYS_PER_WEEK;
  const monday = shiftDays(today, -mondayOffset);

  return WEEK_LABELS.map((label, index) => {
    const date = shiftDays(monday, index);
    return {
      label,
      active: active.has(dayKey(date)),
      isToday: dayKey(date) === dayKey(today),
    };
  });
}

/** Activity totals for the last 7 days including today. */
export function getWeeklyTotals(
  events: readonly ActivityEvent[],
  now: Date = new Date(),
): WeeklyTotals {
  const windowStart = shiftDays(startOfDay(now), -(DAYS_PER_WEEK - 1)).getTime();
  const recent = events.filter((event) => new Date(event.occurredAt).getTime() >= windowStart);
  const count = (type: ActivityEvent["type"]) =>
    recent.filter((event) => event.type === type).length;

  return { tasks: count("task"), topics: count("learning"), milestones: count("milestone") };
}

/** "Today", "Yesterday", otherwise "N days ago" by calendar day. */
export function formatActivityDay(isoDate: string, now: Date = new Date()): string {
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(isoDate)).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
