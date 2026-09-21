import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TopicProgress, TopicStatus } from "../features/learning/types/learning";
import { getTopicKey } from "../features/learning/utils/topicKey";

/** Follows the `auraStack.<domain>.<key>` convention of the project store. */
const LEARNING_STORAGE_KEY = "auraStack.learning";

/** v2: `statuses` (status only) became `progress` (status + completedAt). */
const LEARNING_STORAGE_VERSION = 2;

interface LearningStoreState {
  /** User progress on top of the topic catalog, keyed by `getTopicKey`. */
  progress: Readonly<Record<string, TopicProgress>>;
  /** `completedAt` is only kept for completed topics. */
  setTopicStatus: (
    projectId: string,
    topicId: string,
    status: TopicStatus,
    completedAt?: string,
  ) => void;
}

interface PersistedLearningV1 {
  statuses?: Readonly<Record<string, TopicStatus>>;
}

/**
 * Client-side learning progress. Only progress is persisted; the topic
 * catalog stays outside the store and is derived from the projects. The
 * server (FastAPI → MongoDB) becomes the source of truth later.
 */
export const useLearningStore = create<LearningStoreState>()(
  persist(
    (set) => ({
      progress: {},
      setTopicStatus: (projectId, topicId, status, completedAt) =>
        set((state) => ({
          progress: {
            ...state.progress,
            [getTopicKey(projectId, topicId)]:
              status === "completed" ? { status, completedAt } : { status },
          },
        })),
    }),
    {
      name: LEARNING_STORAGE_KEY,
      version: LEARNING_STORAGE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ progress: state.progress }),
      migrate: (persisted, version) => {
        if (version >= LEARNING_STORAGE_VERSION) return persisted as LearningStoreState;
        const { statuses = {} } = (persisted ?? {}) as PersistedLearningV1;
        const progress = Object.fromEntries(
          Object.entries(statuses).map(([key, status]) => [key, { status }]),
        );
        return { progress } as unknown as LearningStoreState;
      },
    },
  ),
);
