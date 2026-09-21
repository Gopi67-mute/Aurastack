import { useMemo } from "react";

import type { LearningSummary, LearningTopic, ProjectLearning } from "../types/learning";
import { getNextTopic } from "../utils/getNextTopic";
import { summarizeTopics } from "../utils/summarizeTopics";
import { useLearningData } from "./useLearningData";

export interface ProjectLearningOverview {
  project: ProjectLearning;
  summary: LearningSummary;
  /** First incomplete topic in learning order; undefined once all are done. */
  nextTopic: LearningTopic | undefined;
}

/**
 * Supplies the global Learning overview. Totals are derived from the topics
 * themselves (sum of completed / sum of total), never averaged percentages.
 */
export function useLearningOverview(): {
  overall: LearningSummary;
  projects: readonly ProjectLearningOverview[];
} {
  const data = useLearningData();
  return useMemo(
    () => ({
      overall: summarizeTopics(data.flatMap((project) => project.topics)),
      projects: data.map((project) => ({
        project,
        summary: summarizeTopics(project.topics),
        nextTopic: getNextTopic(project.topics),
      })),
    }),
    [data],
  );
}
