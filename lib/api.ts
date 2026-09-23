/**
 * Thin fetch wrapper for the FastAPI backend. Every backend response is the
 * `{ success, message, data, errors, metadata }` envelope described in
 * AGENTS.md; this unwraps it so callers keep working with the same typed
 * shapes (Project, ProjectLearning, ...) the mock services already returned.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // No JSON body (e.g. a 204 or a network-layer error page); handled below.
  }

  if (!response.ok || !body?.success) {
    throw new ApiError(body?.message ?? `Request failed with status ${response.status}`, response.status);
  }

  return body.data as T;
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
