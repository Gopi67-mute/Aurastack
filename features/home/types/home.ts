import type { Project, ProjectIconKey } from "../../projects/types/projects";

export type { ProjectIconKey };

/** Home shows the same projects as the Projects tab. */
export type RecentProject = Project;

export interface HomeData {
  /**
   * Overall learning percentage, 0-100: completed / total topics across every
   * project's active curriculum, the same figure the Learning screen shows.
   */
  overallProgress: number;
  projects: {
    total: number;
    active: number;
  };
  learning: {
    completedTopics: number;
    totalTopics: number;
  };
  momentum: {
    streakDays: number;
    /** Learning topics completed in the last 7 days, as counted by the backend. */
    topicsThisWeek: number;
  };
  recentProjects: readonly RecentProject[];
}
