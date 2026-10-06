import type { LearningTopic, ProjectLearning } from "../types/learning";
import { getLastActivityAt } from "./getLastActivityAt";

function topic(id: string, completedAt: string | null): LearningTopic {
  return {
    id,
    projectId: "p1",
    title: id,
    description: "d",
    order: 1,
    status: completedAt ? "completed" : "not_started",
    completedAt,
    content: { what: "w", why: "y", how: "h", example: "e", apply: "a", miniTask: null },
  };
}

function project(topics: LearningTopic[]): ProjectLearning {
  return { projectId: "p1", projectName: "P", iconKey: null, createdAt: "2026-10-01T00:00:00.000Z", topics };
}

describe("getLastActivityAt", () => {
  it("falls back to the creation time when every completedAt is null", () => {
    expect(getLastActivityAt(project([topic("a", null), topic("b", null)]))).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("ignores null completedAt values next to real completions", () => {
    expect(
      getLastActivityAt(project([topic("a", null), topic("b", "2026-10-05T00:00:00.000Z")])),
    ).toBe("2026-10-05T00:00:00.000Z");
  });
});
