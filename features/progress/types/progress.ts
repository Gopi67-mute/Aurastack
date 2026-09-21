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
