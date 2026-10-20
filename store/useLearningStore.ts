import { create } from "zustand";

import { getLearning } from "../features/learning/services/getLearning";
import type { LearningTopic, ProjectLearning } from "../features/learning/types/learning";
import { getTopicKey } from "../features/learning/utils/topicKey";
import type { GetToken } from "../lib/api";
import { shouldLoad, toErrorMessage, type RemoteStatus } from "../lib/remoteData";

const LOAD_ERROR = "Couldn't load your learning topics.";

interface LearningStoreState {
  /** Curricula with the user's persisted progress already applied by the backend. */
  learning: readonly ProjectLearning[];
  status: RemoteStatus;
  error: string | null;
  /**
   * Topics opened during this session, keyed by `getTopicKey`. Read as
   * "in_progress" on top of the backend's status. Deliberately not persisted:
   * opening a topic is a UI signal, not a completion, and only completions are
   * server state.
   */
  openedTopics: Readonly<Record<string, true>>;
  /**
   * Fetches once per session; `force` refetches. A forced load requested
   * while another is in flight runs once that one settles, and resolves then.
   */
  load: (getToken: GetToken, force?: boolean) => Promise<void>;
  markOpened: (projectId: string, topicId: string) => void;
  /** Stores the topic the backend returned from a completion. */
  applyCompletedTopic: (projectId: string, completed: LearningTopic) => void;
  /** Forgets the signed-out user's learning and drops responses still in flight. */
  reset: () => void;
}

const INITIAL_STATE = {
  learning: [],
  status: "idle",
  error: null,
  openedTopics: {},
} as const satisfies Partial<LearningStoreState>;

/**
 * Learning topics and progress, as returned by the backend. Single source for
 * Home, both Learning views and topic completion.
 *
 * Not persisted: completions live in MongoDB, so the server is the source of
 * truth and a device cache could otherwise show one user's progress to the
 * next one to sign in.
 */
export const useLearningStore = create<LearningStoreState>()((set, get) => {
  // Not store state: no screen renders from these.
  let inFlight: Promise<void> | null = null;
  /** A forced load arrived during `inFlight`, whose response may predate the change behind it. */
  let reloadRequested = false;
  /** Bumped by reset(); anything started for the previous user is dropped. */
  let session = 0;

  const fetchLearning = async (getToken: GetToken, startedIn: number) => {
    set({ status: "loading", error: null });
    try {
      const learning = await getLearning(getToken);
      if (session === startedIn) set({ learning, status: "ready", error: null });
    } catch (err) {
      if (session === startedIn) set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
    }
  };

  /** One load, then one more for each batch of forced loads requested meanwhile. */
  const loadCoalesced = async (getToken: GetToken) => {
    const startedIn = session;
    do {
      reloadRequested = false;
      await fetchLearning(getToken, startedIn);
    } while (reloadRequested && session === startedIn);
  };

  return {
    ...INITIAL_STATE,

    load: (getToken, force = false) => {
      if (inFlight) {
        if (force) reloadRequested = true;
        return inFlight;
      }
      if (!shouldLoad(get().status, force)) return Promise.resolve();
      const run: Promise<void> = loadCoalesced(getToken).finally(() => {
        if (inFlight === run) inFlight = null;
      });
      inFlight = run;
      return run;
    },

    markOpened: (projectId, topicId) => {
      const key = getTopicKey(projectId, topicId);
      if (get().openedTopics[key]) return;
      set((state) => ({ openedTopics: { ...state.openedTopics, [key]: true } }));
    },

    applyCompletedTopic: (projectId, completed) =>
      set((state) => ({
        learning: state.learning.map((project) =>
          project.projectId === projectId
            ? {
                ...project,
                topics: project.topics.map((topic) =>
                  topic.id === completed.id ? completed : topic,
                ),
              }
            : project,
        ),
      })),

    reset: () => {
      session += 1;
      inFlight = null;
      reloadRequested = false;
      set(INITIAL_STATE);
    },
  };
});
