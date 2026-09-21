import { useMemo } from "react";

import { useLearningStore } from "../../../store/useLearningStore";
import { useProjects } from "../../projects/hooks/useProjects";
import { getProjectTopics } from "../services/getProjectTopics";
import type { ProjectLearning } from "../types/learning";
import { getTopicKey } from "../utils/topicKey";

/**
 * Projects → topics → progress. Each project from the shared project store
 * (same list and order as the Projects tab) gets its topic catalog with the
 * user's persisted progress applied. The single source for Home, both
 * Learning views and completion, so a new project appears everywhere at once.
 */
export function useLearningData(): readonly ProjectLearning[] {
  const { projects } = useProjects();
  const progress = useLearningStore((state) => state.progress);
  return useMemo(
    () =>
      projects.map((project) => ({
        projectId: project.id,
        projectName: project.name,
        iconKey: project.iconKey,
        topics: getProjectTopics(project).map((topic) => {
          const saved = progress[getTopicKey(project.id, topic.id)];
          return saved
            ? { ...topic, status: saved.status, completedAt: saved.completedAt }
            : topic;
        }),
      })),
    [projects, progress],
  );
}
