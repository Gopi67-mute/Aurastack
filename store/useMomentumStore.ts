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
}

/**
 * The backend-authoritative Momentum/Streak state, shared by Home and
 * Progress. The streak is never derived here — completing a topic refetches
 * this so the UI shows exactly what the backend calculated.
 */
export const useMomentumStore = create<MomentumStoreState>()((set, get) => ({
  momentum: null,
  status: "idle",
  error: null,

  load: async (getToken, force = false) => {
    if (!shouldLoad(get().status, force)) return;
    set({ status: "loading", error: null });
    try {
      set({ momentum: await getMomentum(getToken), status: "ready", error: null });
    } catch (err) {
      set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
    }
  },
}));
