import { getLastCompletedAt } from "../../learning/utils/getLastActivityAt";
import type { ProjectLearning } from "../../learning/types/learning";
import type { Project } from "../../projects/types/projects";
import { isActiveProject } from "../../projects/utils/isActiveProject";
import type { ProfileStats, RecentProfileProject } from "../types/profile";

/** A project counts as recent when created or studied within this many days. */
export const RECENT_WINDOW_DAYS = 7;
export const RECENT_PROJECTS_LIMIT = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toTime(isoDate: string): number {
  const time = Date.parse(isoDate);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Each project's latest real activity: its last topic completion, or its
 * creation when nothing has been completed. Keeps the server's order.
 */
export function getProjectActivity(
  projects: readonly Project[],
  learning: readonly ProjectLearning[],
): RecentProfileProject[] {
  const learningById = new Map(learning.map((entry) => [entry.projectId, entry]));
  return projects.map((project) => {
    const entry = learningById.get(project.id);
    const studiedAt = entry ? getLastCompletedAt(entry) : null;
    return studiedAt
      ? { project, activityKind: "studied", activityAt: studiedAt }
      : { project, activityKind: "created", activityAt: project.createdAt };
  });
}

/** Most recently active first; ties keep the server's newest-first order. */
export function getRecentProjects(
  activity: readonly RecentProfileProject[],
  limit: number = RECENT_PROJECTS_LIMIT,
): RecentProfileProject[] {
  return [...activity]
    .sort((a, b) => toTime(b.activityAt) - toTime(a.activityAt))
    .slice(0, limit);
}

interface StatsInput {
  activity: readonly RecentProfileProject[];
  learning: readonly ProjectLearning[];
  /** False until the project list has loaded at least once. */
  hasProjects: boolean;
  /** False until learning has loaded at least once. */
  hasLearning: boolean;
  now: number;
}

/**
 * Workspace figures from the user's own projects and learning. A figure whose
 * source has not loaded is null rather than a misleading zero.
 */
export function getProfileStats({
  activity,
  learning,
  hasProjects,
  hasLearning,
  now,
}: StatsInput): ProfileStats {
  const recentSince = now - RECENT_WINDOW_DAYS * MS_PER_DAY;
  return {
    totalProjects: hasProjects ? activity.length : null,
    inProgress: hasProjects
      ? activity.filter(({ project }) => isActiveProject(project)).length
      : null,
    learningPaths: hasLearning ? learning.filter((entry) => entry.topics.length > 0).length : null,
    // Needs learning too: without completions, studied projects would be missed.
    recentProjects:
      hasProjects && hasLearning
        ? activity.filter(({ activityAt }) => toTime(activityAt) >= recentSince).length
        : null,
  };
}
