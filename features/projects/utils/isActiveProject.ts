import type { Project } from "../types/projects";

/**
 * Still generating, or ready with learning left. A failed project is not
 * active. Shared by Home's "active" count and Profile's "In Progress" figure
 * so the two never disagree.
 */
export function isActiveProject(project: Project): boolean {
  return project.status === "generating" || (project.status === "ready" && project.progress < 100);
}
