import { useCallback, useMemo } from "react";

import type { RemoteStatus } from "../../../lib/remoteData";
import { useLearningData } from "../../learning/hooks/useLearningData";
import { useProjects } from "../../projects/hooks/useProjects";
import type { ProfileStats, RecentProfileProject } from "../types/profile";
import { getProfileStats, getProjectActivity, getRecentProjects } from "../utils/profileStats";

export interface ProfileOverview {
  stats: ProfileStats;
  recentProjects: readonly RecentProfileProject[];
  /** False until the project list has loaded once; an empty list then really means none. */
  hasProjects: boolean;
  /** True until projects and learning have each loaded (or failed) once. */
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Loaded at least once: the store holds a server list, even if a refetch failed since. */
function hasLoaded(status: RemoteStatus, itemCount: number): boolean {
  return status === "ready" || itemCount > 0;
}

function isPending(status: RemoteStatus): boolean {
  return status === "idle" || status === "loading";
}

/**
 * The signed-in user's workspace figures and most recently active projects.
 * Reads the shared project and learning stores, so it reuses whatever Home or
 * Learning already fetched and adds no requests of its own. Both lists come
 * from the backend scoped to the authenticated user, and the stores are reset
 * on sign-out, so another account's projects can never appear here.
 */
export function useProfileOverview(): ProfileOverview {
  const projectsState = useProjects();
  const learningState = useLearningData();
  const { projects } = projectsState;
  const learning = learningState.data;

  const hasProjects = hasLoaded(projectsState.status, projects.length);
  const hasLearning = hasLoaded(learningState.status, learning.length);

  const derived = useMemo(() => {
    const activity = getProjectActivity(projects, learning);
    return {
      stats: getProfileStats({ activity, learning, hasProjects, hasLearning, now: Date.now() }),
      recentProjects: getRecentProjects(activity),
    };
  }, [projects, learning, hasProjects, hasLearning]);

  const refreshProjects = projectsState.refresh;
  const refreshLearning = learningState.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([refreshProjects(), refreshLearning()]);
  }, [refreshProjects, refreshLearning]);

  return {
    ...derived,
    hasProjects,
    isLoading:
      (!hasProjects && isPending(projectsState.status)) ||
      (!hasLearning && isPending(learningState.status)),
    error: projectsState.error ?? learningState.error,
    refresh,
  };
}
