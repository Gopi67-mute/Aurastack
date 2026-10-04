import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useMemo, useState } from "react";

import { toErrorMessage, type RemoteStatus } from "../../../lib/remoteData";
import { useLearningStore } from "../../../store/useLearningStore";
import { useMomentumStore } from "../../../store/useMomentumStore";
import { completeLearningTopic } from "../services/completeLearningTopic";
import type { LearningTopic, ProjectLearning } from "../types/learning";
import { useLearningData } from "./useLearningData";

const COMPLETE_ERROR = "Couldn't save that topic as completed. Please try again.";

interface UseLearningTopicResult {
  project: ProjectLearning | undefined;
  topic: LearningTopic | undefined;
  status: RemoteStatus;
  error: string | null;
  /** True while the completion request is in flight. */
  isCompleting: boolean;
  /** Null unless the last completion attempt failed. */
  completeError: string | null;
  markCompleted: () => Promise<void>;
}

/**
 * Resolves one topic by project + topic id. Opening a not-started topic shows
 * it as in_progress for this session; `markCompleted` persists the completion
 * on the backend and refreshes the authoritative Momentum/Streak state.
 */
export function useLearningTopic(
  projectId: string | undefined,
  topicId: string | undefined,
): UseLearningTopicResult {
  const { getToken } = useAuth();
  const { data, status, error } = useLearningData();
  const markOpened = useLearningStore((state) => state.markOpened);
  const applyCompletedTopic = useLearningStore((state) => state.applyCompletedTopic);
  const loadMomentum = useMomentumStore((state) => state.load);

  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const { project, topic } = useMemo(() => {
    const foundProject = data.find((candidate) => candidate.projectId === projectId);
    const foundTopic = foundProject?.topics.find((candidate) => candidate.id === topicId);
    return { project: foundProject, topic: foundTopic };
  }, [data, projectId, topicId]);

  const shouldStart = topic?.status === "not_started";
  useEffect(() => {
    if (shouldStart && projectId && topicId) markOpened(projectId, topicId);
  }, [shouldStart, projectId, topicId, markOpened]);

  const markCompleted = useCallback(async () => {
    if (!projectId || !topicId || isCompleting) return;

    setIsCompleting(true);
    setCompleteError(null);
    try {
      // The backend's response is the authoritative topic state, including the
      // original completedAt when this topic was already completed.
      applyCompletedTopic(projectId, await completeLearningTopic(projectId, topicId, getToken));
      // The completion produced a qualifying activity, so the streak may have
      // changed. Refetch rather than adjusting it here.
      await loadMomentum(getToken, true);
    } catch (err) {
      // Surfaced to the user: never claim the completion persisted when it did not.
      setCompleteError(toErrorMessage(err, COMPLETE_ERROR));
    } finally {
      setIsCompleting(false);
    }
  }, [projectId, topicId, isCompleting, getToken, applyCompletedTopic, loadMomentum]);

  return { project, topic, status, error, isCompleting, completeError, markCompleted };
}
