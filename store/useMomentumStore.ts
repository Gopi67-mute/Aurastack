import { create } from "zustand";

import { getMomentum } from "../features/progress/services/getMomentum";
import type { MomentumState } from "../features/progress/types/progress";
import type { GetToken } from "../lib/api";
import { shouldLoad, toErrorMessage, type RemoteStatus } from "../lib/remoteData";

const LOAD_ERROR = "Couldn't load your momentum.";

interface MomentumStoreState {
  /** Null until the first successful load. */
  momentum: MomentumState | null;
  status: RemoteStatus;
  error: string | null;
  /** Fetches once per session; `force` refetches after recording activity. */
  load: (getToken: GetToken, force?: boolean) => Promise<void>;
  /** Forgets the signed-out user's momentum and drops a response still in flight. */
  reset: () => void;
}

/**
 * The backend-authoritative Momentum/Streak state, shared by Home and
 * Progress. The streak is never derived here — completing a topic refetches
 * this so the UI shows exactly what the backend calculated.
 */
export const useMomentumStore = create<MomentumStoreState>()((set, get) => {
  /** Bumped by reset(); a load started for the previous user is dropped. */
  let session = 0;

  return {
    momentum: null,
    status: "idle",
    error: null,

    load: async (getToken, force = false) => {
      if (!shouldLoad(get().status, force)) return;
      const startedIn = session;
      set({ status: "loading", error: null });
      try {
        const momentum = await getMomentum(getToken);
        if (session === startedIn) set({ momentum, status: "ready", error: null });
      } catch (err) {
        if (session === startedIn) set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
      }
    },

    reset: () => {
      session += 1;
      set({ momentum: null, status: "idle", error: null });
    },
  };
});
