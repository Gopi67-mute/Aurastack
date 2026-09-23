import { useMemo } from "react";

import type { LearningSummary, LearningTopic, ProjectLearning } from "../types/learning";
import { getLastActivityAt } from "../utils/getLastActivityAt";
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
 *
 * `projects` is ordered most-recently-active first (latest topic completion,
 * falling back to project creation time), the single ordering both Continue
 * Learning and All Projects read from.
 */
export function useLearningOverview(): {
  overall: LearningSummary;
  projects: readonly ProjectLearningOverview[];
} {
  const data = useLearningData();
  return useMemo(() => {
    const projects = data
      .map((project) => ({
        project,
        summary: summarizeTopics(project.topics),
        nextTopic: getNextTopic(project.topics),
      }))
      .sort((a, b) => getLastActivityAt(b.project).localeCompare(getLastActivityAt(a.project)));

    return {
      overall: summarizeTopics(data.flatMap((project) => project.topics)),
      projects,
    };
  }, [data]);
}
