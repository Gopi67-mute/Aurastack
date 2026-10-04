import { useCallback, useEffect } from "react";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import type { RemoteStatus } from "../../../lib/remoteData";
import { useMomentumStore } from "../../../store/useMomentumStore";
import type { MomentumState } from "../types/progress";

export interface UseMomentumResult {
  /** Null until the first successful load. */
  momentum: MomentumState | null;
  status: RemoteStatus;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * The backend-authoritative Momentum/Streak state. Shared by Home and
 * Progress through the momentum store, so both show the same numbers and only
 * one request is made.
 */
export function useMomentum(): UseMomentumResult {
  const getToken = useStableGetToken();
  const momentum = useMomentumStore((state) => state.momentum);
  const status = useMomentumStore((state) => state.status);
  const error = useMomentumStore((state) => state.error);
  const load = useMomentumStore((state) => state.load);

  useEffect(() => {
    load(getToken);
  }, [load, getToken]);

  const refresh = useCallback(() => load(getToken, true), [load, getToken]);

  return { momentum, status, error, refresh };
}
