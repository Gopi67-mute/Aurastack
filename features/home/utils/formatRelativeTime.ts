const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * Formats a past timestamp as "3 days ago", "1 week ago", "1 month ago", etc.
 * Invalid or future dates read as "Just now".
 */
export function formatRelativeTime(
  isoDate: string,
  now: number = Date.now(),
): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return "Just now";

  const minutes = Math.floor((now - timestamp) / MS_PER_MINUTE);
  if (minutes < 1) return "Just now";
  if (minutes < MINUTES_PER_HOUR) return pluralize(minutes, "minute");

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return pluralize(hours, "hour");

  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_PER_WEEK) return pluralize(days, "day");
  if (days < DAYS_PER_MONTH) {
    return pluralize(Math.floor(days / DAYS_PER_WEEK), "week");
  }
  if (days < DAYS_PER_YEAR) {
    return pluralize(Math.floor(days / DAYS_PER_MONTH), "month");
  }
  return pluralize(Math.floor(days / DAYS_PER_YEAR), "year");
}
