import { api, type GetToken } from "../../../lib/api";
import type { ProjectLearning } from "../types/learning";

/**
 * Every owned project with its curriculum and the user's persisted progress,
 * in one request. The backend applies progress server-side, so topic status
 * and `completedAt` arrive already resolved.
 */
export async function getLearning(getToken: GetToken): Promise<ProjectLearning[]> {
  return api.get<ProjectLearning[]>("/api/v1/learning", getToken);
}
