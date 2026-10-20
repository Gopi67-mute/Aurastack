import { getLearningPercent } from "../../home/utils/getLearningPercent";
import type { LearningSummary, LearningTopic } from "../types/learning";

/**
 * Derives completed / total / percent from a list of topics. Pass topics
 * flattened across projects for the global figure (never average percentages).
 */
export function summarizeTopics(topics: readonly LearningTopic[]): LearningSummary {
  const completed = topics.filter((topic) => topic.status === "completed").length;
  const total = topics.length;
  return { completed, total, percent: getLearningPercent(completed, total) };
}
