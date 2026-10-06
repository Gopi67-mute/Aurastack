import { act, renderHook } from "@testing-library/react-native";

import { useLearningStore } from "../../../store/useLearningStore";
import { useMomentumStore } from "../../../store/useMomentumStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { getMomentum } from "../../progress/services/getMomentum";
import type { MomentumState } from "../../progress/types/progress";
import { getProjects } from "../../projects/services/getProjects";
import type { Project } from "../../projects/types/projects";
import { completeLearningTopic } from "../services/completeLearningTopic";
import type { LearningTopic, ProjectLearning } from "../types/learning";
import { useLearningTopic } from "./useLearningTopic";

jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));
jest.mock("../services/completeLearningTopic", () => ({ completeLearningTopic: jest.fn() }));
jest.mock("../../projects/services/getProjects", () => ({ getProjects: jest.fn() }));
jest.mock("../../progress/services/getMomentum", () => ({ getMomentum: jest.fn() }));

const mockComplete = jest.mocked(completeLearningTopic);
const mockGetProjects = jest.mocked(getProjects);
const mockGetMomentum = jest.mocked(getMomentum);

function topic(id: string, order: number): LearningTopic {
  return {
    id,
    projectId: "p1",
    title: id,
    description: "d",
    order,
    status: "not_started",
    completedAt: null,
    content: { what: "w", why: "y", how: "h", example: "e", apply: "a", miniTask: null },
  };
}

const LEARNING: ProjectLearning = {
  projectId: "p1",
  projectName: "Storefront",
  iconKey: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  topics: [topic("t1", 1), topic("t2", 2), topic("t3", 3), topic("t4", 4)],
};

function project(progress: number): Project {
  return { id: "p1", name: "Storefront", status: "ready", progress, createdAt: "2026-10-01T00:00:00.000Z" };
}

beforeEach(() => {
  mockComplete.mockReset();
  mockGetProjects.mockReset();
  mockGetMomentum.mockReset();
  useLearningStore.getState().reset();
  useLearningStore.setState({ learning: [LEARNING], status: "ready" });
  useProjectStore.getState().stopGenerationPolling();
  useProjectStore.setState({ projects: [project(0)], status: "ready", error: null });
  useMomentumStore.setState({ momentum: null, status: "ready", error: null });
});

describe("useLearningTopic completion", () => {
  it("refreshes the server's project progress and momentum after completing", async () => {
    mockComplete.mockResolvedValue({
      ...topic("t1", 1),
      status: "completed",
      completedAt: "2026-10-06T09:00:00+00:00",
    });
    mockGetProjects.mockResolvedValue([project(25)]);
    mockGetMomentum.mockResolvedValue({ streakDays: 1 } as MomentumState);

    const { result } = renderHook(() => useLearningTopic("p1", "t1"));
    await act(() => result.current.markCompleted());

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    expect(mockGetMomentum).toHaveBeenCalledTimes(1);
    // Exactly what the backend calculated; nothing derived on the client.
    expect(useProjectStore.getState().projects[0].progress).toBe(25);
    expect(result.current.topic?.status).toBe("completed");
    expect(result.current.completeError).toBeNull();
  });

  it("refreshes nothing when the completion fails", async () => {
    mockComplete.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useLearningTopic("p1", "t1"));
    await act(() => result.current.markCompleted());

    expect(mockGetProjects).not.toHaveBeenCalled();
    expect(mockGetMomentum).not.toHaveBeenCalled();
    expect(useProjectStore.getState().projects[0].progress).toBe(0);
    expect(result.current.completeError).not.toBeNull();
  });
});
