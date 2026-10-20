import type { LearningTopic } from "../types/learning";

/** First incomplete topic in the project's learning order, if any. */
export function getNextTopic(topics: readonly LearningTopic[]): LearningTopic | undefined {
  return topics.find((topic) => topic.status !== "completed");
}
