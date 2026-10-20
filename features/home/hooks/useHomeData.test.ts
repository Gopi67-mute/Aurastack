import { renderHook } from "@testing-library/react-native";

import { useLearningOverview } from "../../learning/hooks/useLearningOverview";
import type { LearningSummary } from "../../learning/types/learning";
import { useMomentum } from "../../progress/hooks/useMomentum";
import type { MomentumState } from "../../progress/types/progress";
import { useProjects } from "../../projects/hooks/useProjects";
import type { Project, ProjectStatus } from "../../projects/types/projects";
import { useHomeData } from "./useHomeData";

jest.mock("../../projects/hooks/useProjects", () => ({ useProjects: jest.fn() }));
jest.mock("../../learning/hooks/useLearningOverview", () => ({ useLearningOverview: jest.fn() }));
jest.mock("../../progress/hooks/useMomentum", () => ({ useMomentum: jest.fn() }));

const refresh = () => Promise.resolve();

function project(id: string, status: ProjectStatus, progress: number): Project {
  return { id, name: id, status, progress, createdAt: "2026-10-01T00:00:00.000Z" };
}

function momentum(topics: number): MomentumState {
  return {
    streakDays: 2,
    isActiveToday: true,
    lastActivityDay: "2026-10-06",
    totalActiveDays: 2,
    timezone: "UTC",
    week: [],
    weekly: { tasks: 0, topics, milestones: 0 },
    recentActivity: [],
  };
}

function given({
  projects = [],
  overall = { completed: 0, total: 0, percent: 0 },
  weeklyTopics = 0,
}: {
  projects?: Project[];
  overall?: LearningSummary;
  weeklyTopics?: number;
}) {
  jest.mocked(useProjects).mockReturnValue({ projects, status: "ready", error: null, refresh });
  jest.mocked(useLearningOverview).mockReturnValue({
    overall,
    projects: [],
    status: "ready",
    error: null,
    refresh,
  });
  jest.mocked(useMomentum).mockReturnValue({
    momentum: momentum(weeklyTopics),
    status: "ready",
    error: null,
    refresh,
  });
}

describe("useHomeData", () => {
  it("reports 0% overall progress for a new user rather than a placeholder", () => {
    given({});
    const { result } = renderHook(() => useHomeData());

    expect(result.current.data.overallProgress).toBe(0);
  });

  it("uses the server-backed overall learning percentage, the same figure as Learning", () => {
    given({
      projects: [project("a", "ready", 50), project("b", "ready", 25)],
      overall: { completed: 3, total: 8, percent: 38 },
    });
    const { result } = renderHook(() => useHomeData());

    expect(result.current.data.overallProgress).toBe(38);
    expect(result.current.data.learning).toEqual({ completedTopics: 3, totalTopics: 8 });
  });

  it("passes the server's project progress through untouched", () => {
    const projects = [project("a", "ready", 67)];
    given({ projects });
    const { result } = renderHook(() => useHomeData());

    expect(result.current.data.recentProjects[0].progress).toBe(67);
  });

  it("counts generating projects and unfinished ready projects as active, never failed ones", () => {
    given({
      projects: [
        project("generating", "generating", 0),
        project("ready-started", "ready", 40),
        project("ready-new", "ready", 0),
        project("ready-done", "ready", 100),
        project("failed", "failed", 0),
      ],
    });
    const { result } = renderHook(() => useHomeData());

    expect(result.current.data.projects).toEqual({ total: 5, active: 3 });
  });

  it("reports momentum as learning topics completed this week", () => {
    given({ weeklyTopics: 4 });
    const { result } = renderHook(() => useHomeData());

    expect(result.current.data.momentum).toEqual({ streakDays: 2, topicsThisWeek: 4 });
  });
});
