import { useCallback, useEffect, useMemo } from "react";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import type { RemoteStatus } from "../../../lib/remoteData";
import { useLearningStore } from "../../../store/useLearningStore";
import type { ProjectLearning } from "../types/learning";
import { getTopicKey } from "../utils/topicKey";

export interface UseLearningDataResult {
  data: readonly ProjectLearning[];
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Every project's curriculum with the user's progress, from the backend.
 * The single source for Home, both Learning views and completion, so a new
 * project appears everywhere at once.
 *
 * Statuses come from the backend, with one client-side addition: a topic the
 * user opened this session shows as `in_progress` while the backend still
 * reports `not_started`. Only completions are server state.
 */
export function useLearningData(): UseLearningDataResult {
  const getToken = useStableGetToken();
  const learning = useLearningStore((state) => state.learning);
  const openedTopics = useLearningStore((state) => state.openedTopics);
  const status = useLearningStore((state) => state.status);
  const error = useLearningStore((state) => state.error);
  const load = useLearningStore((state) => state.load);

  useEffect(() => {
    load(getToken);
  }, [load, getToken]);

  const refresh = useCallback(() => load(getToken, true), [load, getToken]);

  const data = useMemo(
    () =>
      learning.map((project) => ({
        ...project,
        topics: project.topics.map((topic) =>
          topic.status === "not_started" && openedTopics[getTopicKey(project.projectId, topic.id)]
            ? { ...topic, status: "in_progress" as const }
            : topic,
        ),
      })),
    [learning, openedTopics],
  );

  return { data, status, error, refresh };
}
