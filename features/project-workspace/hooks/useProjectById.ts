import type { RemoteStatus } from "../../../lib/remoteData";
import { useProjects } from "../../projects/hooks/useProjects";
import type { Project } from "../../projects/types/projects";

interface UseProjectByIdResult {
  project: Project | undefined;
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Looks up a project in the shared project list. `status` lets callers avoid
 * showing "not found" before the list has been fetched (cold start or a deep
 * link straight into a workspace).
 */
export function useProjectById(projectId: string | undefined): UseProjectByIdResult {
  const { projects, status, error, refresh } = useProjects();
  const project =
    projectId === undefined
      ? undefined
      : projects.find((candidate) => candidate.id === projectId);

  return { project, status, error, refresh };
}
