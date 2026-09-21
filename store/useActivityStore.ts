import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ActivityEvent } from "../features/progress/types/progress";

const ACTIVITY_STORAGE_KEY = "auraStack.activity";

/** Bump when the persisted shape changes and add a `migrate`. */
const ACTIVITY_STORAGE_VERSION = 1;

interface ActivityStoreState {
  /** Activity recorded by the user in this app (excludes mock seed activity). */
  events: readonly ActivityEvent[];
  addEvent: (event: ActivityEvent) => void;
}

/**
 * Client-side activity feed backing Progress/Momentum and the daily streak.
 * The server becomes the source of truth later.
 */
export const useActivityStore = create<ActivityStoreState>()(
  persist(
    (set) => ({
      events: [],
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
    }),
    {
      name: ACTIVITY_STORAGE_KEY,
      version: ACTIVITY_STORAGE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ events: state.events }),
    },
  ),
);
