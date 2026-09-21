import { useEffect, useMemo } from "react";

import { useLearningStore } from "../../../store/useLearningStore";
import { completeLearningTopic } from "../services/completeLearningTopic";
import type { LearningTopic, ProjectLearning } from "../types/learning";
import { useLearningData } from "./useLearningData";

interface UseLearningTopicResult {
  project: ProjectLearning | undefined;
  topic: LearningTopic | undefined;
  markCompleted: () => void;
}

/**
 * Resolves one topic by project + topic id. Opening a not-started topic moves
 * it to in_progress; `markCompleted` completes it and records activity.
 */
export function useLearningTopic(
  projectId: string | undefined,
  topicId: string | undefined,
): UseLearningTopicResult {
  const data = useLearningData();
  const setTopicStatus = useLearningStore((state) => state.setTopicStatus);

  const { project, topic } = useMemo(() => {
    const foundProject = data.find((candidate) => candidate.projectId === projectId);
    const foundTopic = foundProject?.topics.find((candidate) => candidate.id === topicId);
    return { project: foundProject, topic: foundTopic };
  }, [data, projectId, topicId]);

  const shouldStart = topic?.status === "not_started";
  useEffect(() => {
    if (shouldStart && projectId && topicId) setTopicStatus(projectId, topicId, "in_progress");
  }, [shouldStart, projectId, topicId, setTopicStatus]);

  const markCompleted = () => {
    if (project && topic) completeLearningTopic(project, topic);
  };

  return { project, topic, markCompleted };
}
