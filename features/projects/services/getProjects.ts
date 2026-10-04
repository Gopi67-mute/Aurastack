import { api, type GetToken } from "../../../lib/api";
import type { Project } from "../types/projects";

/**
 * The authenticated user's projects, newest first. The backend scopes the
 * query to the Clerk user id on the token, so this can only ever return
 * projects the caller owns.
 */
export async function getProjects(getToken: GetToken): Promise<Project[]> {
  return api.get<Project[]>("/api/v1/projects", getToken);
}
