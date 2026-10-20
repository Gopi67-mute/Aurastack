import type { LearningSummary } from "../types/learning";

export type ContinueLearningLabel = "START LEARNING" | "CONTINUE";

/**
 * CTA label for a project's Continue Learning card. Only called for projects
 * that still have an incomplete topic, so it never needs a "completed" case.
 */
export function getContinueLearningLabel(summary: LearningSummary): ContinueLearningLabel {
  return summary.completed === 0 ? "START LEARNING" : "CONTINUE";
}
