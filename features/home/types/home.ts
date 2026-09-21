import type { Project, ProjectIconKey } from "../../projects/types/projects";

export type { ProjectIconKey };

/** Home shows the same projects as the Projects tab. */
export type RecentProject = Project;

export interface HomeData {
  /** Overall completion percentage across the user's work, 0-100. */
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
    tasksDone: number;
  };
  recentProjects: readonly RecentProject[];
}
