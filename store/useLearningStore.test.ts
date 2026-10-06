import { getLearning } from "../features/learning/services/getLearning";
import type { ProjectLearning } from "../features/learning/types/learning";
import { useLearningStore } from "./useLearningStore";

jest.mock("../features/learning/services/getLearning", () => ({ getLearning: jest.fn() }));

const mockGetLearning = jest.mocked(getLearning);
const getToken = () => Promise.resolve("test-token");

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function learning(projectId: string, topicCount: number): ProjectLearning {
  return {
    projectId,
    projectName: projectId,
    createdAt: "2026-10-01T00:00:00.000Z",
    topics: Array.from({ length: topicCount }, (_, index) => ({
      id: `${projectId}-${index}`,
      projectId,
      title: "T",
      description: "d",
      order: index + 1,
      status: "not_started" as const,
      content: { what: "w", why: "y", how: "h", example: "e", apply: "a" },
    })),
  };
}

beforeEach(() => {
  mockGetLearning.mockReset();
  useLearningStore.getState().reset();
});

describe("useLearningStore load coalescing", () => {
  it("runs exactly one fresh load after the in-flight one when forced meanwhile", async () => {
    const first = deferred<ProjectLearning[]>();
    // The first response was produced before the project's curriculum existed.
    mockGetLearning
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([learning("new", 3)]);

    const loadA = useLearningStore.getState().load(getToken);
    const forced = useLearningStore.getState().load(getToken, true);
    const forcedAgain = useLearningStore.getState().load(getToken, true);
    expect(mockGetLearning).toHaveBeenCalledTimes(1);

    first.resolve([learning("new", 0)]);
    await Promise.all([loadA, forced, forcedAgain]);

    expect(mockGetLearning).toHaveBeenCalledTimes(2);
    expect(useLearningStore.getState().learning[0].topics).toHaveLength(3);
    expect(useLearningStore.getState().status).toBe("ready");
  });

  it("does not reload when only unforced loads arrive meanwhile, and never loops", async () => {
    const first = deferred<ProjectLearning[]>();
    mockGetLearning.mockReturnValueOnce(first.promise).mockResolvedValue([learning("p", 1)]);

    const loadA = useLearningStore.getState().load(getToken);
    const unforced = useLearningStore.getState().load(getToken);
    first.resolve([learning("p", 1)]);
    await Promise.all([loadA, unforced]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetLearning).toHaveBeenCalledTimes(1);
  });

  it("still runs the pending reload when the in-flight load fails", async () => {
    const first = deferred<ProjectLearning[]>();
    mockGetLearning
      .mockReturnValueOnce(first.promise.then(() => Promise.reject(new Error("offline"))))
      .mockResolvedValueOnce([learning("p", 2)]);

    const loadA = useLearningStore.getState().load(getToken);
    const forced = useLearningStore.getState().load(getToken, true);
    first.resolve([]);
    await Promise.all([loadA, forced]);

    expect(mockGetLearning).toHaveBeenCalledTimes(2);
    expect(useLearningStore.getState().status).toBe("ready");
    expect(useLearningStore.getState().error).toBeNull();
  });

  it("starts a new load once the previous one has settled", async () => {
    mockGetLearning.mockResolvedValue([learning("p", 1)]);

    await useLearningStore.getState().load(getToken);
    await useLearningStore.getState().load(getToken, true);

    expect(mockGetLearning).toHaveBeenCalledTimes(2);
  });
});
