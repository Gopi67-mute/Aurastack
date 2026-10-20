import { clampProgress } from "./getAuraMessage";

/** Completed / total topics as a whole percentage; 0 when there are no topics. */
export function getLearningPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return clampProgress((completed / total) * 100);
}
