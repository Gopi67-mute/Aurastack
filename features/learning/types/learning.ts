import type { ProjectIconKey } from "../../projects/types/projects";

export type TopicStatus = "not_started" | "in_progress" | "completed";

/** Lesson body shown on the topic screen. The API will return this shape. */
export interface TopicContent {
  what: string;
  why: string;
  how: string;
  example: string;
  apply: string;
  /** Null when the topic has no mini task. */
  miniTask?: string | null;
}

export interface LearningTopic {
  id: string;
  /** The project this topic belongs to. */
  projectId: string;
  title: string;
  /** One-line summary shown on "next topic" cards. */
  description: string;
  /** 1-based position in the project's learning order. */
  order: number;
  status: TopicStatus;
  /** ISO 8601 timestamp; null until the topic is completed. */
  completedAt?: string | null;
  content: TopicContent;
}

/** The user's persisted progress on one topic. */
export interface TopicProgress {
  status: TopicStatus;
  completedAt?: string | null;
}

/**
 * Learning topics belong to a project; the API will return this shape.
 * `topics` is in learning order: the next topic is the first incomplete one.
 */
export interface ProjectLearning {
  projectId: string;
  projectName: string;
  /** Null until a generated icon exists. */
  iconKey?: ProjectIconKey | null;
  /** ISO 8601 timestamp; fallback ordering signal when no topic has been completed yet. */
  createdAt: string;
  topics: readonly LearningTopic[];
}

export interface LearningSummary {
  completed: number;
  total: number;
  /** Whole percentage, 0-100. */
  percent: number;
}
