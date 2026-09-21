import { useMemo } from "react";

import type { ActivityEvent, WeekDay, WeeklyTotals } from "../types/progress";
import { getStreakDays, getWeekDays, getWeeklyTotals } from "../utils/progressStats";
import { useActivityEvents } from "./useActivityEvents";

const RECENT_ACTIVITY_LIMIT = 6;

export interface ProgressOverview {
  streakDays: number;
  week: readonly WeekDay[];
  weekly: WeeklyTotals;
  recentActivity: readonly ActivityEvent[];
}

/**
 * Supplies the global Progress overview, derived from the activity feed.
 * V1 reads mock plus locally recorded activity; swap the source for the API later.
 */
export function useProgressOverview(): ProgressOverview {
  const events = useActivityEvents();
  return useMemo(() => {
    const now = new Date();
    const recentActivity = [...events]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, RECENT_ACTIVITY_LIMIT);

    return {
      streakDays: getStreakDays(events, now),
      week: getWeekDays(events, now),
      weekly: getWeeklyTotals(events, now),
      recentActivity,
    };
  }, [events]);
}
