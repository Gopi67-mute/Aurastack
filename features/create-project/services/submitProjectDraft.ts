import type { Project } from "../../projects/types/projects";
import type { ProjectDraft } from "../types/createProject";

const ID_RANDOM_LENGTH = 6;

function createProjectId(): string {
  const random = Math.random().toString(36).slice(2, 2 + ID_RANDOM_LENGTH);
  return `local-${Date.now().toString(36)}-${random}`;
}

/**
 * Temporary local stand-in for the future `POST /projects/generate` call.
 * Makes no network request and produces no AI data: it only turns the
 * validated draft into a "preparing" Project (no stack, roadmap, etc.).
 * Replace the body with the real API call, which will return the Project.
 */
export async function submitProjectDraft(draft: ProjectDraft): Promise<Project> {
  return {
    id: createProjectId(),
    name: draft.title,
    description: draft.description,
    platforms: draft.platforms,
    status: "preparing",
    progress: 0,
    createdAt: new Date().toISOString(),
  };
}
