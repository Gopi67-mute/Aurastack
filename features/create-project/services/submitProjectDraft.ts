import { api, type GetToken } from "../../../lib/api";
import type { Project } from "../../projects/types/projects";
import type { ProjectDraft } from "../types/createProject";

/**
 * Creates the project on the backend (FastAPI persists it in MongoDB, scoped
 * to the authenticated Clerk user, and generates its learning curriculum).
 * Returns the "preparing" Project the backend created.
 */
export async function submitProjectDraft(draft: ProjectDraft, getToken: GetToken): Promise<Project> {
  return api.post<Project>("/api/v1/projects", getToken, {
    title: draft.title,
    description: draft.description,
    platforms: draft.platforms,
  });
}
