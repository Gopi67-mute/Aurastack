import { useCallback, useEffect } from "react";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import { useProjectStore } from "../../../store/useProjectStore";
import type { RemoteStatus } from "../../../lib/remoteData";
import type { Project } from "../types/projects";

export interface UseProjectsResult {
  /** Newest first, as ordered by the backend. */
  projects: readonly Project[];
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The user's projects from the backend, shared through the project store so
 * several mounted screens trigger a single request.
 */
export function useProjects(): UseProjectsResult {
  const getToken = useStableGetToken();
  const projects = useProjectStore((state) => state.projects);
  const status = useProjectStore((state) => state.status);
  const error = useProjectStore((state) => state.error);
  const load = useProjectStore((state) => state.load);

  useEffect(() => {
    load(getToken);
  }, [load, getToken]);

  const refresh = useCallback(() => load(getToken, true), [load, getToken]);

  return { projects, status, error, refresh };
}
