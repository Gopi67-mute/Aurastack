export type ActivityType = "task" | "learning" | "milestone";

/** One completed unit of development activity. The API will return this shape. */
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  description: string;
  /** Set when the activity belongs to a project (e.g. a learning completion). */
  projectId?: string;
  projectName?: string;
  /** ISO 8601 timestamp. */
  occurredAt: string;
}

export interface WeekDay {
  label: string;
  /** At least one activity happened on this day. */
  active: boolean;
  isToday: boolean;
}

export interface WeeklyTotals {
  tasks: number;
  topics: number;
  milestones: number;
}

/**
 * The backend-authoritative Momentum/Streak state, returned by
 * GET /api/v1/momentum. Mirrors backend/app/schemas/activity.py::MomentumState.
 *
 * The backend owns every calendar-day and streak decision here; the client
 * only renders it.
 */
export interface MomentumState {
  streakDays: number;
  /** A qualifying activity already happened today in `timezone`. */
  isActiveToday: boolean;
  /** Most recent active calendar day as YYYY-MM-DD, in `timezone`. */
  lastActivityDay: string | null;
  totalActiveDays: number;
  /** The IANA timezone every day in this response was resolved against. */
  timezone: string;
  week: readonly WeekDay[];
  weekly: WeeklyTotals;
  recentActivity: readonly ActivityEvent[];
}
