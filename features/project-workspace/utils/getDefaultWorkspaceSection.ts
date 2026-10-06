import type { ProjectStatus } from "../../projects/types/projects";
import { DEFAULT_WORKSPACE_SECTION } from "../constants/sections";
import type { WorkspaceSectionKey } from "../types/workspace";

/**
 * The section a workspace opens on until the user picks one. A ready project
 * opens on its learning plan; while generating or failed (or still loading)
 * there is no plan to show yet.
 */
export function getDefaultWorkspaceSection(status: ProjectStatus | undefined): WorkspaceSectionKey {
  return status === "ready" ? "learning" : DEFAULT_WORKSPACE_SECTION;
}
