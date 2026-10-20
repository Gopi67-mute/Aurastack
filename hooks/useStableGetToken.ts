import { useAuth } from "@clerk/expo";
import { useCallback, useEffect, useRef } from "react";

import type { GetToken } from "../lib/api";

/**
 * Clerk's `getToken` with a stable identity.
 *
 * `@clerk/expo`'s `useAuth` returns a new `getToken` function on every render,
 * so using it directly as an effect or callback dependency re-runs that effect
 * on every render. This always calls the latest `getToken` through a ref, so
 * the session it reads from is never stale.
 */
export function useStableGetToken(): GetToken {
  const { getToken } = useAuth();
  const latest = useRef(getToken);

  useEffect(() => {
    latest.current = getToken;
  }, [getToken]);

  return useCallback(() => latest.current(), []);
}
