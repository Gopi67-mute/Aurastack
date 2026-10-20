/**
 * Shared vocabulary for the stores that mirror a backend collection, so they
 * all behave the same way for loading, errors and re-entrancy.
 */

import { ApiError } from "./api";

export type RemoteStatus = "idle" | "loading" | "ready" | "error";

/**
 * Whether a store should start a fetch. Prevents the duplicate requests that
 * would otherwise happen when several mounted screens read the same store,
 * and prevents an already-loaded collection being refetched on every mount.
 *
 * Only `idle` loads automatically. A failed load stays in `error` until the
 * user retries (`force`): retrying on its own would re-fail on every render
 * and loop indefinitely while the backend or network is down.
 */
export function shouldLoad(status: RemoteStatus, force = false): boolean {
  if (status === "loading") return false;
  return force || status === "idle";
}

/**
 * A safe, user-facing message for anything thrown by the API layer.
 *
 * `ApiError` messages come from lib/api.ts or the backend's response envelope
 * — never a token, secret or stack trace — so they are surfaced as-is to help
 * diagnose real failures. Anything else falls back to `fallback`.
 */
export function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
