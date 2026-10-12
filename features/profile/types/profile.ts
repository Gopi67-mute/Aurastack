import type { Project } from "../../projects/types/projects";

/** Who is signed in, as the Profile header shows it. */
export interface ProfileIdentity {
  displayName: string;
  /** One or two uppercase letters; empty when no name or email is known. */
  initials: string;
  email: string | null;
  /** A real profile photo (uploaded or from OAuth); null shows the initials. */
  imageUrl: string | null;
}

/**
 * Workspace figures. Null means the data behind a figure has not loaded (or
 * failed to), so the UI shows it as unavailable instead of guessing a value.
 */
export interface ProfileStats {
  totalProjects: number | null;
  /** Projects created, or with a topic completed, in the last RECENT_WINDOW_DAYS. */
  recentProjects: number | null;
  /** Projects whose generated curriculum has at least one topic. */
  learningPaths: number | null;
  /** Same rule as Home's "active" count (see isActiveProject). */
  inProgress: number | null;
}

/**
 * "studied": `at` is the latest topic completion.
 * "created": nothing completed yet, so `at` is the creation time.
 */
export type ProjectActivityKind = "studied" | "created";

export interface RecentProfileProject {
  project: Project;
  activityKind: ProjectActivityKind;
  /** ISO 8601 timestamp the list is ordered by. */
  activityAt: string;
}
