import { create } from "zustand";

import { getProjects } from "../features/projects/services/getProjects";
import { retryProjectGeneration } from "../features/projects/services/retryProjectGeneration";
import type { Project } from "../features/projects/types/projects";
import { ApiError, type GetToken } from "../lib/api";
import { shouldLoad, toErrorMessage, type RemoteStatus } from "../lib/remoteData";
import { useLearningStore } from "./useLearningStore";

const LOAD_ERROR = "Couldn't load your projects.";

/** How often projects are re-read while any of them is still generating. */
export const GENERATION_POLL_INTERVAL_MS = 3_000;

/**
 * Polling stops after this long even if a project still reads "generating".
 * Matches the backend's generation lease, after which a stalled generation is
 * reported as failed anyway; a manual refresh resumes polling if needed.
 */
export const GENERATION_POLL_MAX_MS = 120_000;

interface ProjectStoreState {
  projects: readonly Project[];
  status: RemoteStatus;
  error: string | null;
  /** Fetches once per session; `force` refetches (e.g. pull to refresh). */
  load: (getToken: GetToken, force?: boolean) => Promise<void>;
  /** Adds a project the backend just created and follows its generation. */
  addProject: (project: Project, getToken: GetToken) => void;
  /**
   * Restarts a failed generation and follows it. Rejects with the API error
   * when the backend refuses, except a 409, which means the project already
   * moved on (retried elsewhere, or finished) and just resyncs the list.
   */
  retryGeneration: (projectId: string, getToken: GetToken) => Promise<void>;
  stopGenerationPolling: () => void;
}

interface PollState {
  timer: ReturnType<typeof setTimeout> | null;
  deadline: number;
}

const isGenerating = (project: Project): boolean => project.status === "generating";

/** True when a project that was generating in `previous` is ready in `next`. */
function hasNewlyReadyProject(previous: readonly Project[], next: readonly Project[]): boolean {
  const generating = new Set(previous.filter(isGenerating).map((project) => project.id));
  return next.some((project) => project.status === "ready" && generating.has(project.id));
}

/**
 * The user's projects, as returned by the backend. Shared by Home, Projects,
 * the workspace and Learning so every screen shows the same list.
 *
 * While any project is generating, the list is re-read every few seconds
 * (silently: `status` is not touched, so screens do not flash a loading
 * state). When a project turns ready, learning is refreshed once to pick up
 * its new curriculum.
 *
 * Not persisted: the backend is the source of truth, and caching one user's
 * projects on the device would risk showing them after a different user signs
 * in. A previously fetched list is kept on a failed refetch so the UI can show
 * stale data alongside the error rather than emptying out.
 */
export const useProjectStore = create<ProjectStoreState>()((set, get) => {
  // Not store state: no screen renders from it, so changes must not re-render.
  let poll: PollState | null = null;

  const stopPolling = () => {
    if (poll?.timer) clearTimeout(poll.timer);
    poll = null;
  };

  /** Stores a project list from the backend and reacts to lifecycle changes in it. */
  const receive = (
    projects: readonly Project[],
    getToken: GetToken,
    extra: Partial<ProjectStoreState> = {},
  ) => {
    const previous = get().projects;
    set({ ...extra, projects });
    if (hasNewlyReadyProject(previous, projects)) {
      // A failed refresh is surfaced by the learning store itself.
      useLearningStore.getState().load(getToken, true).catch(() => {});
    }
    followGeneration(getToken, false);
  };

  const scheduleNextPoll = (current: PollState, getToken: GetToken) => {
    // Stopped, or replaced by a newer polling run, while a request was in flight.
    if (poll !== current) return;
    if (!get().projects.some(isGenerating) || Date.now() >= current.deadline) {
      stopPolling();
      return;
    }
    current.timer = setTimeout(async () => {
      current.timer = null;
      try {
        receive(await getProjects(getToken), getToken);
      } catch {
        // Not surfaced: the list on screen is still valid, and the next tick retries.
      }
      scheduleNextPoll(current, getToken);
    }, GENERATION_POLL_INTERVAL_MS);
  };

  /** Starts polling if any project is generating; `restart` extends the deadline. */
  const followGeneration = (getToken: GetToken, restart: boolean) => {
    if (!get().projects.some(isGenerating)) {
      stopPolling();
      return;
    }
    if (poll) {
      if (restart) poll.deadline = Date.now() + GENERATION_POLL_MAX_MS;
      return;
    }
    poll = { timer: null, deadline: Date.now() + GENERATION_POLL_MAX_MS };
    scheduleNextPoll(poll, getToken);
  };

  return {
    projects: [],
    status: "idle",
    error: null,

    load: async (getToken, force = false) => {
      if (!shouldLoad(get().status, force)) return;
      set({ status: "loading", error: null });
      try {
        receive(await getProjects(getToken), getToken, { status: "ready", error: null });
      } catch (err) {
        set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
      }
    },

    addProject: (project, getToken) => {
      set((state) => ({ projects: [project, ...state.projects] }));
      followGeneration(getToken, true);
    },

    retryGeneration: async (projectId, getToken) => {
      let updated: Project;
      try {
        updated = await retryProjectGeneration(projectId, getToken);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          await get().load(getToken, true);
          return;
        }
        throw err;
      }
      set((state) => ({
        projects: state.projects.map((project) => (project.id === updated.id ? updated : project)),
      }));
      followGeneration(getToken, true);
    },

    stopGenerationPolling: stopPolling,
  };
});
