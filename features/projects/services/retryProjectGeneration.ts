import { api, type GetToken } from "../../../lib/api";
import type { Project } from "../types/projects";

/**
 * Restarts generation of a project whose generation failed or stalled.
 * Resolves with the project back in "generating"; the backend generates in
 * the background, so callers follow it by re-reading projects.
 *
 * Rejects with a 409 `ApiError` when the project is already generating or
 * has finished, and 404 when it does not exist for this user.
 */
export async function retryProjectGeneration(projectId: string, getToken: GetToken): Promise<Project> {
  return api.post<Project>(`/api/v1/projects/${projectId}/generation/retry`, getToken);
}
