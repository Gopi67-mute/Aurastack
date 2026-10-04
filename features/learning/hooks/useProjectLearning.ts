import { useMemo } from "react";

import type { RemoteStatus } from "../../../lib/remoteData";
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
  status: RemoteStatus;
  error: string | null;
} {
  const { data, status, error } = useLearningData();
  return useMemo(() => {
    const project = data.find((candidate) => candidate.projectId === projectId);
    const topics = project?.topics ?? [];
    return {
      project,
      summary: summarizeTopics(topics),
      nextTopic: getNextTopic(topics),
      status,
      error,
    };
  }, [data, projectId, status, error]);
}
