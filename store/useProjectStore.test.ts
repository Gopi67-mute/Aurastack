import { getProjects } from "../features/projects/services/getProjects";
import { retryProjectGeneration } from "../features/projects/services/retryProjectGeneration";
import type { Project, ProjectStatus } from "../features/projects/types/projects";
import { ApiError, REQUEST_TIMEOUT_MS } from "../lib/api";
import { useLearningStore } from "./useLearningStore";
import {
  GENERATION_LEASE_MS,
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_POLL_MAX_MS,
  useProjectStore,
} from "./useProjectStore";

jest.mock("../features/projects/services/getProjects", () => ({ getProjects: jest.fn() }));
jest.mock("../features/projects/services/retryProjectGeneration", () => ({
  retryProjectGeneration: jest.fn(),
}));

const mockGetProjects = jest.mocked(getProjects);
const mockRetry = jest.mocked(retryProjectGeneration);
const mockLoadLearning = jest.fn((): Promise<void> => Promise.resolve());
const getToken = () => Promise.resolve("test-token");

function project(id: string, status: ProjectStatus): Project {
  return { id, name: id, status, progress: 0, createdAt: "2026-10-01T00:00:00.000Z" };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const ids = () => useProjectStore.getState().projects.map((candidate) => candidate.id);
const statusOf = (id: string) =>
  useProjectStore.getState().projects.find((candidate) => candidate.id === id)?.status;

/** Runs the next poll tick, including the request it makes. */
async function tick(times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGetProjects.mockReset();
  mockRetry.mockReset();
  mockLoadLearning.mockClear();
  useProjectStore.getState().reset();
  useLearningStore.setState({ load: mockLoadLearning });
});

afterEach(() => {
  useProjectStore.getState().stopGenerationPolling();
  jest.useRealTimers();
});

describe("useProjectStore generation polling", () => {
  it("does not poll when no project is generating", async () => {
    mockGetProjects.mockResolvedValue([project("a", "ready"), project("b", "failed")]);

    await useProjectStore.getState().load(getToken);
    await tick(5);

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });

  it("polls every interval while a project is generating and stops once none are", async () => {
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating")])
      .mockResolvedValueOnce([project("a", "generating")])
      .mockResolvedValueOnce([project("a", "ready")]);

    await useProjectStore.getState().load(getToken);
    expect(mockGetProjects).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS - 1);
    expect(mockGetProjects).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    expect(mockGetProjects).toHaveBeenCalledTimes(2);

    await tick();
    expect(mockGetProjects).toHaveBeenCalledTimes(3);
    expect(useProjectStore.getState().projects[0].status).toBe("ready");

    await tick(10);
    expect(mockGetProjects).toHaveBeenCalledTimes(3);
  });

  it("polls silently, without putting the list back into a loading state", async () => {
    mockGetProjects.mockResolvedValue([project("a", "generating")]);
    await useProjectStore.getState().load(getToken);

    const statuses: string[] = [];
    const unsubscribe = useProjectStore.subscribe((state) => statuses.push(state.status));
    await tick(3);
    unsubscribe();

    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((status) => status === "ready")).toBe(true);
  });

  it("refreshes learning once when a project becomes ready, not on every poll", async () => {
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating"), project("b", "generating")])
      .mockResolvedValueOnce([project("a", "ready"), project("b", "generating")])
      .mockResolvedValue([project("a", "ready"), project("b", "generating")]);

    await useProjectStore.getState().load(getToken);
    expect(mockLoadLearning).not.toHaveBeenCalled();

    await tick();
    expect(mockLoadLearning).toHaveBeenCalledTimes(1);
    expect(mockLoadLearning).toHaveBeenCalledWith(getToken, true);

    // "b" keeps generating, so polling continues without reloading learning.
    await tick(4);
    expect(mockGetProjects).toHaveBeenCalledTimes(6);
    expect(mockLoadLearning).toHaveBeenCalledTimes(1);
  });

  it("does not refresh learning for a project that failed", async () => {
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating")])
      .mockResolvedValueOnce([project("a", "failed")]);

    await useProjectStore.getState().load(getToken);
    await tick(3);

    expect(mockLoadLearning).not.toHaveBeenCalled();
    expect(mockGetProjects).toHaveBeenCalledTimes(2);
  });

  it("gives up after the maximum polling duration", async () => {
    mockGetProjects.mockResolvedValue([project("a", "generating")]);

    await useProjectStore.getState().load(getToken);
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_MAX_MS);
    const callsAtCap = mockGetProjects.mock.calls.length;
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_MAX_MS);

    expect(callsAtCap).toBe(1 + GENERATION_POLL_MAX_MS / GENERATION_POLL_INTERVAL_MS);
    expect(mockGetProjects).toHaveBeenCalledTimes(callsAtCap);
  });

  it("keeps polling through a failed poll", async () => {
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating")])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([project("a", "ready")]);

    await useProjectStore.getState().load(getToken);
    await tick();
    expect(useProjectStore.getState().projects[0].status).toBe("generating");
    expect(useProjectStore.getState().error).toBeNull();

    await tick();
    expect(useProjectStore.getState().projects[0].status).toBe("ready");
    expect(mockLoadLearning).toHaveBeenCalledTimes(1);
  });

  it("starts polling when a newly created project is added", async () => {
    mockGetProjects.mockResolvedValueOnce([project("new", "ready")]);

    useProjectStore.getState().addProject(project("new", "generating"), getToken);
    expect(mockGetProjects).not.toHaveBeenCalled();

    await tick();
    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    expect(mockLoadLearning).toHaveBeenCalledTimes(1);
  });

  it("does not start a second polling loop when another project is added", async () => {
    mockGetProjects.mockResolvedValue([project("a", "generating"), project("b", "generating")]);

    useProjectStore.getState().addProject(project("a", "generating"), getToken);
    useProjectStore.getState().addProject(project("b", "generating"), getToken);
    await tick();

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });
});

describe("useProjectStore polling deadline", () => {
  it("outlasts the server lease by at least one poll interval and one request timeout", () => {
    expect(GENERATION_POLL_MAX_MS).toBeGreaterThanOrEqual(
      GENERATION_LEASE_MS + GENERATION_POLL_INTERVAL_MS + REQUEST_TIMEOUT_MS,
    );
  });

  it("keeps polling past the lease until the server reports the stalled generation as failed", async () => {
    const start = Date.now();
    // The worker was lost: the server keeps reporting "generating" until its
    // lease has expired, then reports the project as failed.
    mockGetProjects.mockImplementation(async () => [
      project("a", Date.now() - start >= GENERATION_LEASE_MS + 1_000 ? "failed" : "generating"),
    ]);

    await useProjectStore.getState().load(getToken);
    await jest.advanceTimersByTimeAsync(GENERATION_LEASE_MS);
    expect(statusOf("a")).toBe("generating");
    const callsAtLease = mockGetProjects.mock.calls.length;

    await jest.advanceTimersByTimeAsync(GENERATION_LEASE_MS / 120); // t = 121s
    await tick();
    expect(mockGetProjects.mock.calls.length).toBeGreaterThan(callsAtLease);
    expect(statusOf("a")).toBe("failed");

    const callsAtFailure = mockGetProjects.mock.calls.length;
    await tick(10);
    expect(mockGetProjects).toHaveBeenCalledTimes(callsAtFailure);
  });
});

describe("useProjectStore stale responses", () => {
  it("does not let a poll that started before addProject drop the new project", async () => {
    const stalePoll = deferred<Project[]>();
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating")])
      .mockReturnValueOnce(stalePoll.promise)
      .mockResolvedValue([project("new", "generating"), project("a", "generating")]);
    await useProjectStore.getState().load(getToken);
    await tick(); // The poll is now in flight.

    useProjectStore.getState().addProject(project("new", "generating"), getToken);
    stalePoll.resolve([project("a", "generating")]);
    await jest.advanceTimersByTimeAsync(0);

    expect(ids()).toEqual(["new", "a"]);

    // Polling carries on, and the next read is applied.
    await tick();
    expect(mockGetProjects).toHaveBeenCalledTimes(3);
    expect(ids()).toEqual(["new", "a"]);
  });

  it("does not let a poll that started before a retry regress the retried project", async () => {
    const stalePoll = deferred<Project[]>();
    mockGetProjects
      .mockResolvedValueOnce([project("a", "generating"), project("b", "failed")])
      .mockReturnValueOnce(stalePoll.promise)
      .mockResolvedValue([project("a", "generating"), project("b", "ready")]);
    mockRetry.mockResolvedValueOnce(project("b", "generating"));
    await useProjectStore.getState().load(getToken);
    await tick(); // The poll is now in flight.

    await useProjectStore.getState().retryGeneration("b", getToken);
    stalePoll.resolve([project("a", "generating"), project("b", "failed")]);
    await jest.advanceTimersByTimeAsync(0);

    expect(statusOf("b")).toBe("generating");

    await tick();
    expect(mockGetProjects).toHaveBeenCalledTimes(3);
    expect(statusOf("b")).toBe("ready");
  });

  it("re-reads when a project is added while the list is loading", async () => {
    const staleLoad = deferred<Project[]>();
    mockGetProjects
      .mockReturnValueOnce(staleLoad.promise)
      .mockResolvedValueOnce([project("new", "generating"), project("old", "ready")]);

    const loading = useProjectStore.getState().load(getToken);
    useProjectStore.getState().addProject(project("new", "generating"), getToken);
    staleLoad.resolve([project("old", "ready")]);
    await loading;

    expect(mockGetProjects).toHaveBeenCalledTimes(2);
    expect(ids()).toEqual(["new", "old"]);
    expect(useProjectStore.getState().status).toBe("ready");
  });
});

describe("useProjectStore load coalescing", () => {
  const progressOf = (id: string) =>
    useProjectStore.getState().projects.find((candidate) => candidate.id === id)?.progress;

  it("runs exactly one fresh load after the in-flight one when forced meanwhile", async () => {
    const first = deferred<Project[]>();
    const second = deferred<Project[]>();
    const secondRequested = deferred<void>();
    mockGetProjects.mockReturnValueOnce(first.promise).mockImplementationOnce(() => {
      secondRequested.resolve();
      return second.promise;
    });

    const initial = useProjectStore.getState().load(getToken);
    // Two topics completed while the first read was in flight.
    const forced = useProjectStore.getState().load(getToken, true);
    const forcedAgain = useProjectStore.getState().load(getToken, true);
    let forcedSettled = false;
    void forced.then(() => {
      forcedSettled = true;
    });
    expect(mockGetProjects).toHaveBeenCalledTimes(1);

    // The first read predates those completions.
    first.resolve([{ ...project("a", "ready"), progress: 40 }]);
    await secondRequested.promise;
    expect(mockGetProjects).toHaveBeenCalledTimes(2);
    expect(forcedSettled).toBe(false);

    second.resolve([{ ...project("a", "ready"), progress: 60 }]);
    await Promise.all([initial, forced, forcedAgain]);

    expect(progressOf("a")).toBe(60);
    expect(useProjectStore.getState().status).toBe("ready");
    await tick(3);
    expect(mockGetProjects).toHaveBeenCalledTimes(2);
  });

  it("does not reload when only unforced loads arrive meanwhile", async () => {
    const first = deferred<Project[]>();
    mockGetProjects.mockReturnValueOnce(first.promise).mockResolvedValue([project("a", "ready")]);

    const initial = useProjectStore.getState().load(getToken);
    const unforced = useProjectStore.getState().load(getToken);
    first.resolve([project("a", "ready")]);
    await Promise.all([initial, unforced]);
    await tick(3);

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });

  it("drops the pending reload when reset meanwhile", async () => {
    const first = deferred<Project[]>();
    mockGetProjects.mockReturnValueOnce(first.promise).mockResolvedValue([project("b", "ready")]);

    const initial = useProjectStore.getState().load(getToken);
    const forced = useProjectStore.getState().load(getToken, true);
    useProjectStore.getState().reset();
    first.resolve([project("a", "ready")]);
    await Promise.all([initial, forced]);

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual([]);
    expect(useProjectStore.getState().status).toBe("idle");
  });
});

describe("useProjectStore.retryGeneration", () => {
  it("replaces the failed project and follows the new generation", async () => {
    useProjectStore.setState({ projects: [project("a", "failed")], status: "ready" });
    mockRetry.mockResolvedValueOnce(project("a", "generating"));
    mockGetProjects.mockResolvedValueOnce([project("a", "ready")]);

    await useProjectStore.getState().retryGeneration("a", getToken);

    expect(mockRetry).toHaveBeenCalledWith("a", getToken);
    expect(useProjectStore.getState().projects[0].status).toBe("generating");

    await tick();
    expect(useProjectStore.getState().projects[0].status).toBe("ready");
    expect(mockLoadLearning).toHaveBeenCalledTimes(1);
  });

  it("resyncs instead of failing when the backend reports a conflict", async () => {
    useProjectStore.setState({ projects: [project("a", "failed")], status: "ready" });
    mockRetry.mockRejectedValueOnce(new ApiError("Request failed with status 409", 409));
    mockGetProjects.mockResolvedValueOnce([project("a", "generating")]);

    await expect(useProjectStore.getState().retryGeneration("a", getToken)).resolves.toBeUndefined();

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().projects[0].status).toBe("generating");
  });

  it("rejects on other failures and leaves the project unchanged", async () => {
    useProjectStore.setState({ projects: [project("a", "failed")], status: "ready" });
    const offline = new ApiError("Couldn't reach the server.", 0);
    mockRetry.mockRejectedValueOnce(offline);

    await expect(useProjectStore.getState().retryGeneration("a", getToken)).rejects.toBe(offline);

    expect(useProjectStore.getState().projects[0].status).toBe("failed");
    await tick(3);
    expect(mockGetProjects).not.toHaveBeenCalled();
  });
});
