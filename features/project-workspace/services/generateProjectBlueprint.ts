import { api, type GetToken } from "../../../lib/api";
import type { ProjectBlueprintResponse } from "../types/blueprint";

/**
 * Asks the backend to generate a project's blueprint. Resolves with the
 * blueprint in "generating"; the backend generates in the background, so
 * callers follow it by re-reading the blueprint. Never retried here.
 *
 * Rejects with a 409 `ApiError` when the project is not ready, a generation
 * is already running, or the blueprint is already current, and 404 when the
 * project does not exist for this user.
 */
export async function generateProjectBlueprint(
  projectId: string,
  getToken: GetToken,
): Promise<ProjectBlueprintResponse> {
  return api.post<ProjectBlueprintResponse>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/blueprint/generation`,
    getToken,
  );
}
