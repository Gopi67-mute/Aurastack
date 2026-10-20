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
  /**
   * Fetches once per session; `force` refetches after recording activity. A
   * forced load requested while another is in flight runs once that one
   * settles, and resolves then.
   */
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
  // Not store state: no screen renders from these.
  let inFlight: Promise<void> | null = null;
  /** A forced load arrived during `inFlight`, whose response may predate the activity behind it. */
  let reloadRequested = false;
  /** Bumped by reset(); a load started for the previous user is dropped. */
  let session = 0;

  const fetchMomentum = async (getToken: GetToken, startedIn: number) => {
    set({ status: "loading", error: null });
    try {
      const momentum = await getMomentum(getToken);
      if (session === startedIn) set({ momentum, status: "ready", error: null });
    } catch (err) {
      if (session === startedIn) set({ status: "error", error: toErrorMessage(err, LOAD_ERROR) });
    }
  };

  /** One load, then one more for each batch of forced loads requested meanwhile. */
  const loadCoalesced = async (getToken: GetToken) => {
    const startedIn = session;
    do {
      reloadRequested = false;
      await fetchMomentum(getToken, startedIn);
    } while (reloadRequested && session === startedIn);
  };

  return {
    momentum: null,
    status: "idle",
    error: null,

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

    reset: () => {
      session += 1;
      inFlight = null;
      reloadRequested = false;
      set({ momentum: null, status: "idle", error: null });
    },
  };
});
