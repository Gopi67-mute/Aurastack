import type { ProjectLearning } from "../types/learning";

/** The latest topic completion; null when nothing has been completed yet. */
export function getLastCompletedAt(project: ProjectLearning): string | null {
  const completions = project.topics
    .map((topic) => topic.completedAt)
    .filter((value): value is string => Boolean(value));
  if (completions.length === 0) return null;
  return completions.reduce((latest, value) => (value > latest ? value : latest));
}

/**
 * Ordering signal for "recently active first": the latest topic completion,
 * or the project's creation time when nothing has been completed yet.
 */
export function getLastActivityAt(project: ProjectLearning): string {
  return getLastCompletedAt(project) ?? project.createdAt;
}
