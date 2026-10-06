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
 * The backend's generation lease (GENERATION_LEASE_SECONDS in
 * backend/app/core/config.py). A generation still running after this long is
 * presumed dead, and from then on the server reports its project as failed.
 */
export const GENERATION_LEASE_MS = 120_000;

/**
 * Polling stops after this long even if a project still reads "generating";
 * a manual refresh resumes it if needed.
 *
 * It must exceed the lease. A generation whose worker was lost (e.g. a
 * backend restart) never finishes, and only reads "failed" once the server's
 * lease has expired. A client that gave up at the lease could take its last
 * read just before that moment and then show "generating" indefinitely. The
 * 30s margin covers the final poll interval plus one request running to its
 * timeout (REQUEST_TIMEOUT_MS), with room for clock and network delay.
 */
export const GENERATION_POLL_MAX_MS = 150_000;

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
  /**
   * Forgets the signed-out user's projects: stops polling, empties the list
   * and drops every response still in flight, so the next user starts from a
   * fresh load.
   */
  reset: () => void;
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
 * A list read that was already in flight when the list changed locally (a
 * project created or retried) is stale: applying it would drop that change,
 * so it is discarded and the next read, made after the change, is used.
 *
 * Not persisted: the backend is the source of truth, and caching one user's
 * projects on the device would risk showing them after a different user signs
 * in. A previously fetched list is kept on a failed refetch so the UI can show
 * stale data alongside the error rather than emptying out.
 */
export const useProjectStore = create<ProjectStoreState>()((set, get) => {
  // Not store state: no screen renders from these, so changes must not re-render.
  let poll: PollState | null = null;
  /** Bumped by every local change to the list; reads started earlier are stale. */
  let localChanges = 0;
  /** Bumped by reset(); anything started for the previous user is dropped. */
  let session = 0;

  const stopPolling = () => {
    if (poll?.timer) clearTimeout(poll.timer);
    poll = null;
  };

  /** Reads the list; null when a local change or reset made the response stale. */
  const fetchProjects = async (getToken: GetToken): Promise<readonly Project[] | null> => {
    const startedAt = { localChanges, session };
    const projects = await getProjects(getToken);
    return startedAt.localChanges === localChanges && startedAt.session === session
      ? projects
      : null;
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
        const projects = await fetchProjects(getToken);
        // A stale read is skipped; the next tick reads again.
        if (projects) receive(projects, getToken);
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
      const startedIn = session;
      set({ status: "loading", error: null });
      try {
        let projects = await fetchProjects(getToken);
        // Signed out meanwhile: reset() already cleared the store; send nothing more.
        if (session !== startedIn) return;
        // A local change raced the first read, so it may be missing: read once more.
        projects ??= await fetchProjects(getToken);
        if (session !== startedIn) return;
        if (projects) {
          receive(projects, getToken, { status: "ready", error: null });
        } else {
          // Raced twice: keep the local list. Those changes started polling,
          // which brings in the server's list on its next tick.
          set({ status: "ready", error: null });
        }
      } catch (err) {
        if (session === startedIn) set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
      }
    },

    addProject: (project, getToken) => {
      localChanges += 1;
      set((state) => ({ projects: [project, ...state.projects] }));
      followGeneration(getToken, true);
    },

    retryGeneration: async (projectId, getToken) => {
      const startedIn = session;
      let updated: Project;
      try {
        updated = await retryProjectGeneration(projectId, getToken);
      } catch (err) {
        if (session !== startedIn) return;
        if (err instanceof ApiError && err.status === 409) {
          await get().load(getToken, true);
          return;
        }
        throw err;
      }
      if (session !== startedIn) return;
      localChanges += 1;
      set((state) => ({
        projects: state.projects.map((project) => (project.id === updated.id ? updated : project)),
      }));
      followGeneration(getToken, true);
    },

    stopGenerationPolling: stopPolling,

    reset: () => {
      session += 1;
      stopPolling();
      set({ projects: [], status: "idle", error: null });
    },
  };
});
