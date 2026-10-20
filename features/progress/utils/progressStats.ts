const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * "Today", "Yesterday", otherwise "N days ago" by calendar day.
 *
 * Presentation only, in the device's own local time. Streaks, active days and
 * weekly totals are calculated by the backend against the user's IANA
 * timezone and are never derived here.
 */
export function formatActivityDay(isoDate: string, now: Date = new Date()): string {
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(isoDate)).getTime()) / MS_PER_DAY,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
