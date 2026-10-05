import { getProjects } from "../features/projects/services/getProjects";
import { retryProjectGeneration } from "../features/projects/services/retryProjectGeneration";
import type { Project, ProjectStatus } from "../features/projects/types/projects";
import { ApiError } from "../lib/api";
import { useLearningStore } from "./useLearningStore";
import {
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
  useProjectStore.getState().stopGenerationPolling();
  useProjectStore.setState({ projects: [], status: "idle", error: null });
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
