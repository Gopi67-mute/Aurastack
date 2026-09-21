import { useMemo } from "react";

import { useLearningOverview } from "../../learning/hooks/useLearningOverview";
import { useActivityEvents } from "../../progress/hooks/useActivityEvents";
import { getStreakDays, getWeeklyTotals } from "../../progress/utils/progressStats";
import { useProjects } from "../../projects/hooks/useProjects";
import { createMockHomeData } from "../constants/mockHomeData";
import type { HomeData } from "../types/home";

const RECENT_PROJECTS_LIMIT = 3;

/**
 * Supplies Home dashboard data. Project figures come from the shared project
 * store (same source as the Projects tab), learning from the Learning data and
 * momentum from the activity feed, so Home always agrees with those screens.
 * The rest is local mock data to be replaced by an API-backed query later.
 */
export function useHomeData(): { data: HomeData } {
  const { projects } = useProjects();
  const { overall } = useLearningOverview();
  const events = useActivityEvents();
  const data = useMemo<HomeData>(
    () => ({
      ...createMockHomeData(),
      learning: { completedTopics: overall.completed, totalTopics: overall.total },
      momentum: {
        streakDays: getStreakDays(events),
        tasksDone: getWeeklyTotals(events).tasks,
      },
      projects: {
        total: projects.length,
        active: projects.filter((project) => project.progress < 100).length,
      },
      recentProjects: projects.slice(0, RECENT_PROJECTS_LIMIT),
    }),
    [projects, overall, events],
  );
  return { data };
}
