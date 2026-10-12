/**
 * Thin fetch wrapper for the FastAPI backend. Every backend response is the
 * `{ success, message, data, errors, metadata }` envelope described in
 * AGENTS.md; this unwraps it so callers keep working with the same typed
 * shapes (Project, ProjectLearning, ...) the mock services already returned.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Longest a single request may take, auth token and body included. Without a bound, a
 * connection that hangs (no response and no error) leaves its caller awaiting
 * forever — for generation polling, that would stop the loop for good. On
 * timeout the request is aborted and rejects like any other network failure.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";
const TIMEOUT_ERROR = "The server took too long to respond. Please try again.";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
}

/** Matches Clerk's `useAuth().getToken`, without importing Clerk here. */
export type GetToken = () => Promise<string | null>;

/**
 * Settles like `promise`, unless `signal` aborts first; then rejects with the
 * timeout ApiError. `promise` itself keeps running (getToken can't be
 * cancelled) but its late result is ignored.
 */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ApiError(TIMEOUT_ERROR, 0));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort);
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export interface RequestOptions {
  /** Overrides REQUEST_TIMEOUT_MS, e.g. for a synchronous AI reply. */
  timeoutMs?: number;
}

async function request<T>(
  path: string,
  getToken: GetToken,
  init: RequestInit = {},
  { timeoutMs = REQUEST_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new ApiError("Missing EXPO_PUBLIC_API_URL. Add it to your .env file.", 0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // The budget includes getting the token: Clerk may refresh it over the
    // network, and a hang there would otherwise never reach the fetch below.
    const token = await untilAborted(getToken(), controller.signal);
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(controller.signal.aborted ? TIMEOUT_ERROR : NETWORK_ERROR, 0);
    }

    let body: ApiEnvelope<T> | null = null;
    try {
      body = (await response.json()) as ApiEnvelope<T>;
    } catch {
      // No JSON body (e.g. a 204 or a network-layer error page); handled below.
    }
    if (controller.signal.aborted) throw new ApiError(TIMEOUT_ERROR, 0);

    if (!response.ok || !body?.success) {
      throw new ApiError(body?.message ?? `Request failed with status ${response.status}`, response.status);
    }

    return body.data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string, getToken: GetToken): Promise<T> => request<T>(path, getToken),

  post: <T>(path: string, getToken: GetToken, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(
      path,
      getToken,
      { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) },
      options,
    ),

  patch: <T>(path: string, getToken: GetToken, body?: unknown): Promise<T> =>
    request<T>(path, getToken, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),

  delete: <T>(path: string, getToken: GetToken): Promise<T> =>
    request<T>(path, getToken, { method: "DELETE" }),
};
