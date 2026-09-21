import { useMemo } from "react";

import type { LearningSummary, LearningTopic, ProjectLearning } from "../types/learning";
import { getNextTopic } from "../utils/getNextTopic";
import { summarizeTopics } from "../utils/summarizeTopics";
import { useLearningData } from "./useLearningData";

/** One project's learning with its summary; undefined project when unknown. */
export function useProjectLearning(projectId: string | undefined): {
  project: ProjectLearning | undefined;
  summary: LearningSummary;
  /** First incomplete topic in learning order; undefined once all are done. */
  nextTopic: LearningTopic | undefined;
} {
  const data = useLearningData();
  return useMemo(() => {
    const project = data.find((candidate) => candidate.projectId === projectId);
    const topics = project?.topics ?? [];
    return { project, summary: summarizeTopics(topics), nextTopic: getNextTopic(topics) };
  }, [data, projectId]);
}
