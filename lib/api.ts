/**
 * Thin fetch wrapper for the FastAPI backend. Every backend response is the
 * `{ success, message, data, errors, metadata }` envelope described in
 * AGENTS.md; this unwraps it so callers keep working with the same typed
 * shapes (Project, ProjectLearning, ...) the mock services already returned.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Longest a single request may take, body included. Without a bound, a
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

async function request<T>(path: string, getToken: GetToken, init: RequestInit = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError("Missing EXPO_PUBLIC_API_URL. Add it to your .env file.", 0);
  }

  const token = await getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
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

  post: <T>(path: string, getToken: GetToken, body?: unknown): Promise<T> =>
    request<T>(path, getToken, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),

  patch: <T>(path: string, getToken: GetToken, body?: unknown): Promise<T> =>
    request<T>(path, getToken, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),

  delete: <T>(path: string, getToken: GetToken): Promise<T> =>
    request<T>(path, getToken, { method: "DELETE" }),
};
