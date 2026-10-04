import { create } from "zustand";

import { getProjects } from "../features/projects/services/getProjects";
import type { Project } from "../features/projects/types/projects";
import type { GetToken } from "../lib/api";
import { shouldLoad, toErrorMessage, type RemoteStatus } from "../lib/remoteData";

const LOAD_ERROR = "Couldn't load your projects.";

interface ProjectStoreState {
  projects: readonly Project[];
  status: RemoteStatus;
  error: string | null;
  /** Fetches once per session; `force` refetches (e.g. pull to refresh). */
  load: (getToken: GetToken, force?: boolean) => Promise<void>;
  /** Adds a project the backend just created, so the list updates immediately. */
  addProject: (project: Project) => void;
}

/**
 * The user's projects, as returned by the backend. Shared by Home, Projects,
 * the workspace and Learning so every screen shows the same list.
 *
 * Not persisted: the backend is the source of truth, and caching one user's
 * projects on the device would risk showing them after a different user signs
 * in. A previously fetched list is kept on a failed refetch so the UI can show
 * stale data alongside the error rather than emptying out.
 */
export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [],
  status: "idle",
  error: null,

  load: async (getToken, force = false) => {
    if (!shouldLoad(get().status, force)) return;
    set({ status: "loading", error: null });
    try {
      set({ projects: await getProjects(getToken), status: "ready", error: null });
    } catch (err) {
      set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
    }
  },

  addProject: (project) => set((state) => ({ projects: [project, ...state.projects] })),
}));
