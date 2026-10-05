import { api, type GetToken } from "../../../lib/api";
import type { Project } from "../../projects/types/projects";
import type { ProjectDraft } from "../types/createProject";

/**
 * Creates the project on the backend (FastAPI persists it in MongoDB, scoped
 * to the authenticated Clerk user). Returns the Project still "generating":
 * its learning curriculum is generated in the background.
 */
export async function submitProjectDraft(draft: ProjectDraft, getToken: GetToken): Promise<Project> {
  return api.post<Project>("/api/v1/projects", getToken, {
    title: draft.title,
    description: draft.description,
    platforms: draft.platforms,
  });
}
