import { useCallback, useMemo } from "react";

import type { RemoteStatus } from "../../../lib/remoteData";
import { useLearningOverview } from "../../learning/hooks/useLearningOverview";
import { useMomentum } from "../../progress/hooks/useMomentum";
import { useProjects } from "../../projects/hooks/useProjects";
import { isActiveProject } from "../../projects/utils/isActiveProject";
import type { HomeData } from "../types/home";

const RECENT_PROJECTS_LIMIT = 3;

/**
 * Supplies Home dashboard data. Projects, learning and momentum all come from
 * the backend through their shared stores, so Home always agrees with the
 * Projects, Learning and Progress screens. Every figure is server-backed:
 * project progress is calculated by the server, and the overall progress is
 * the Learning overview's own total, never an average of percentages.
 *
 * `status` is the combined state of the three reads: loading while any is
 * still loading, error if any failed.
 */
export function useHomeData(): {
  data: HomeData;
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const projectsState = useProjects();
  const learningState = useLearningOverview();
  const momentumState = useMomentum();

  const { projects } = projectsState;
  const { overall } = learningState;
  const { momentum } = momentumState;

  const data = useMemo<HomeData>(
    () => ({
      overallProgress: overall.percent,
      learning: { completedTopics: overall.completed, totalTopics: overall.total },
      momentum: {
        streakDays: momentum?.streakDays ?? 0,
        topicsThisWeek: momentum?.weekly.topics ?? 0,
      },
      projects: {
        total: projects.length,
        active: projects.filter(isActiveProject).length,
      },
      recentProjects: projects.slice(0, RECENT_PROJECTS_LIMIT),
    }),
    [projects, overall, momentum],
  );

  const states = [projectsState, learningState, momentumState];
  const status: RemoteStatus = states.some((state) => state.status === "loading")
    ? "loading"
    : states.some((state) => state.status === "error")
      ? "error"
      : states.every((state) => state.status === "ready")
        ? "ready"
        : "idle";

  const refreshProjects = projectsState.refresh;
  const refreshLearning = learningState.refresh;
  const refreshMomentum = momentumState.refresh;
  const refresh = useCallback(async () => {
    await Promise.all([refreshProjects(), refreshLearning(), refreshMomentum()]);
  }, [refreshProjects, refreshLearning, refreshMomentum]);

  return { data, status, error: states.find((state) => state.error)?.error ?? null, refresh };
}
