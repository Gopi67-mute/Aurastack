import type { Project } from "../features/projects/types/projects";
import type * as ApiModule from "./api";
import type * as LearningStoreModule from "../store/useLearningStore";
import type * as ProjectStoreModule from "../store/useProjectStore";

// lib/api.ts reads the URL when it is first imported, so the modules under
// test are imported only once it is set.
let api: typeof ApiModule.api;
let ApiError: typeof ApiModule.ApiError;
let REQUEST_TIMEOUT_MS: number;
let useProjectStore: typeof ProjectStoreModule.useProjectStore;
let useLearningStore: typeof LearningStoreModule.useLearningStore;
let GENERATION_POLL_INTERVAL_MS: number;

const mockFetch = jest.fn<Promise<Response>, [string, RequestInit]>();
const getToken = () => Promise.resolve("test-token");

beforeAll(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.test";
  ({ api, ApiError, REQUEST_TIMEOUT_MS } = jest.requireActual<typeof ApiModule>("./api"));
  ({ useProjectStore, GENERATION_POLL_INTERVAL_MS } =
    jest.requireActual<typeof ProjectStoreModule>("../store/useProjectStore"));
  ({ useLearningStore } =
    jest.requireActual<typeof LearningStoreModule>("../store/useLearningStore"));
});

beforeEach(() => {
  jest.useFakeTimers();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  useProjectStore.getState().reset();
  jest.useRealTimers();
});

function ok(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, message: "ok", data }),
  } as Response;
}

/** A request the server never answers; it only ends when aborted. */
function hang(_url: string, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  });
}

function project(status: Project["status"]): Project {
  return { id: "a", name: "a", status, progress: 0, createdAt: "2026-10-01T00:00:00.000Z" };
}

describe("api request timeout", () => {
  it("aborts a request that never answers and rejects with a safe ApiError", async () => {
    mockFetch.mockImplementation(hang);

    const request = api.get("/api/v1/projects", getToken);
    const rejection = expect(request).rejects.toEqual(
      new ApiError("The server took too long to respond. Please try again.", 0),
    );

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(mockFetch.mock.calls[0][1].signal?.aborted).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await rejection;
    expect(mockFetch.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("leaves no timer behind once a request answers in time", async () => {
    mockFetch.mockResolvedValueOnce(ok(["x"]));

    await expect(api.get("/api/v1/projects", getToken)).resolves.toEqual(["x"]);

    expect(jest.getTimerCount()).toBe(0);
  });

  it("times out a getToken that never settles, without sending the request", async () => {
    const hungGetToken = () => new Promise<string | null>(() => {});

    const request = api.get("/api/v1/projects", hungGetToken);
    const rejection = expect(request).rejects.toEqual(
      new ApiError("The server took too long to respond. Please try again.", 0),
    );

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await rejection;
    expect(mockFetch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("shares one budget between getToken and the request", async () => {
    let answerToken: (token: string) => void = () => {};
    const slowGetToken = () => new Promise<string | null>((resolve) => (answerToken = resolve));
    mockFetch.mockImplementation(hang);

    const request = api.get("/api/v1/projects", slowGetToken);
    const rejection = expect(request).rejects.toBeInstanceOf(ApiError);

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1000);
    answerToken("late-token");
    await jest.advanceTimersByTimeAsync(0);
    expect(mockFetch.mock.calls[0][1].headers).toMatchObject({ Authorization: "Bearer late-token" });

    await jest.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(mockFetch.mock.calls[0][1].signal?.aborted).toBe(true);
  });

  it("passes a getToken failure through unchanged", async () => {
    const failure = new Error("clerk unavailable");

    await expect(api.get("/api/v1/projects", () => Promise.reject(failure))).rejects.toBe(failure);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("still reports an unreachable server as a network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

    await expect(api.get("/api/v1/projects", getToken)).rejects.toEqual(
      new ApiError("Couldn't reach the server. Check your connection and try again.", 0),
    );
  });
});

describe("generation polling over a hung request", () => {
  it("times the hung poll out and keeps polling", async () => {
    useLearningStore.setState({ load: () => Promise.resolve() });
    mockFetch
      .mockResolvedValueOnce(ok([project("generating")])) // Initial load.
      .mockImplementationOnce(hang) // First poll: the server never answers.
      .mockResolvedValueOnce(ok([project("ready")])); // Next poll.

    await useProjectStore.getState().load(getToken);
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // The hung poll is aborted at the timeout, and the loop schedules the next tick.
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(mockFetch.mock.calls[1][1].signal?.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(useProjectStore.getState().projects[0].status).toBe("ready");
    expect(useProjectStore.getState().error).toBeNull();
  });
});
