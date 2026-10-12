import { api, type GetToken } from "../../../lib/api";
import type { ProjectBlueprintResponse } from "../types/blueprint";

/**
 * A project's blueprint with its server-derived status. Content is included
 * only when the status is "ready".
 *
 * Rejects with a 404 `ApiError` when the project does not exist for this user.
 */
export async function getProjectBlueprint(
  projectId: string,
  getToken: GetToken,
): Promise<ProjectBlueprintResponse> {
  return api.get<ProjectBlueprintResponse>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/blueprint`,
    getToken,
  );
}
