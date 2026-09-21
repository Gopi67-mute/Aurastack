import type { ProjectIconKey } from "../../projects/types/projects";

export type TopicStatus = "not_started" | "in_progress" | "completed";

/** Lesson body shown on the topic screen. The API will return this shape. */
export interface TopicContent {
  what: string;
  why: string;
  how: string;
  example: string;
  apply: string;
  miniTask?: string;
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
  /** ISO 8601 timestamp; set once the topic is completed. */
  completedAt?: string;
  content: TopicContent;
}

/** The user's persisted progress on one topic. */
export interface TopicProgress {
  status: TopicStatus;
  completedAt?: string;
}

/**
 * Learning topics belong to a project; the API will return this shape.
 * `topics` is in learning order: the next topic is the first incomplete one.
 */
export interface ProjectLearning {
  projectId: string;
  projectName: string;
  iconKey?: ProjectIconKey;
  topics: readonly LearningTopic[];
}

export interface LearningSummary {
  completed: number;
  total: number;
  /** Whole percentage, 0-100. */
  percent: number;
}
