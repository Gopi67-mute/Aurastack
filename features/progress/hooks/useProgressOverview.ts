import type { RemoteStatus } from "../../../lib/remoteData";
import type { ActivityEvent, WeekDay, WeeklyTotals } from "../types/progress";
import { useMomentum } from "./useMomentum";

const EMPTY_WEEKLY: WeeklyTotals = { tasks: 0, topics: 0, milestones: 0 };

export interface ProgressOverview {
  streakDays: number;
  isActiveToday: boolean;
  week: readonly WeekDay[];
  weekly: WeeklyTotals;
  recentActivity: readonly ActivityEvent[];
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The global Progress overview, read straight from the backend's Momentum
 * state. Nothing here is derived on the client: the streak, the week strip and
 * the weekly totals are all calculated server-side against the user's
 * timezone, so Progress and Home can never disagree with the persisted state.
 *
 * Empty values are placeholders for the first load; callers should render the
 * loading and error states from `status` and `error` rather than treating a
 * zero streak as real data.
 */
export function useProgressOverview(): ProgressOverview {
  const { momentum, status, error, refresh } = useMomentum();

  return {
    streakDays: momentum?.streakDays ?? 0,
    isActiveToday: momentum?.isActiveToday ?? false,
    week: momentum?.week ?? [],
    weekly: momentum?.weekly ?? EMPTY_WEEKLY,
    recentActivity: momentum?.recentActivity ?? [],
    status,
    error,
    refresh,
  };
}
