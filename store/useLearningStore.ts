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
  /** Fetches once per session; `force` refetches. */
  load: (getToken: GetToken, force?: boolean) => Promise<void>;
  markOpened: (projectId: string, topicId: string) => void;
  /** Stores the topic the backend returned from a completion. */
  applyCompletedTopic: (projectId: string, completed: LearningTopic) => void;
}

/**
 * Learning topics and progress, as returned by the backend. Single source for
 * Home, both Learning views and topic completion.
 *
 * Not persisted: completions live in MongoDB, so the server is the source of
 * truth and a device cache could otherwise show one user's progress to the
 * next one to sign in.
 */
export const useLearningStore = create<LearningStoreState>()((set, get) => ({
  learning: [],
  status: "idle",
  error: null,
  openedTopics: {},

  load: async (getToken, force = false) => {
    if (!shouldLoad(get().status, force)) return;
    set({ status: "loading", error: null });
    try {
      set({ learning: await getLearning(getToken), status: "ready", error: null });
    } catch (err) {
      set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
    }
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
}));
