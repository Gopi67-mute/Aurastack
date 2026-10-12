import type { LearningTopic, ProjectLearning } from "../../learning/types/learning";
import type { Project, ProjectStatus } from "../../projects/types/projects";
import { getProfileStats, getProjectActivity, getRecentProjects } from "./profileStats";

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number) => hoursAgo(days * 24);

function project(id: string, status: ProjectStatus, progress: number, createdAt: string): Project {
  return { id, name: id, status, progress, createdAt };
}

function topic(projectId: string, completedAt: string | null): LearningTopic {
  return {
    id: `${projectId}-t`,
    projectId,
    title: "Topic",
    description: "",
    order: 1,
    status: completedAt ? "completed" : "not_started",
    completedAt,
    content: { what: "", why: "", how: "", example: "", apply: "" },
  };
}

function learning(projectId: string, topics: LearningTopic[], createdAt = daysAgo(30)): ProjectLearning {
  return { projectId, projectName: projectId, createdAt, topics };
}

// Server order: newest created first.
const projects = [
  project("fresh", "generating", 0, hoursAgo(1)),
  project("studied", "ready", 40, daysAgo(10)),
  project("done", "ready", 100, daysAgo(20)),
  project("failed", "failed", 0, daysAgo(30)),
];
const learningData = [
  learning("studied", [topic("studied", hoursAgo(2)), topic("studied", null)]),
  learning("done", [topic("done", daysAgo(15))]),
  learning("failed", []),
];

describe("getProjectActivity", () => {
  it("uses the latest topic completion, else the creation time", () => {
    const activity = getProjectActivity(projects, learningData);

    expect(activity.map(({ project: { id }, activityKind, activityAt }) => [id, activityKind, activityAt])).toEqual([
      ["fresh", "created", hoursAgo(1)],
      ["studied", "studied", hoursAgo(2)],
      ["done", "studied", daysAgo(15)],
      ["failed", "created", daysAgo(30)],
    ]);
  });
});

describe("getRecentProjects", () => {
  it("orders by latest activity, not creation, and keeps three", () => {
    const old = project("old-but-active", "ready", 10, daysAgo(60));
    const activity = getProjectActivity(
      [...projects, old],
      [...learningData, learning("old-but-active", [topic("old-but-active", hoursAgo(0.5))])],
    );

    expect(getRecentProjects(activity).map(({ project: { id } }) => id)).toEqual([
      "old-but-active",
      "fresh",
      "studied",
    ]);
  });

  it("sorts an unparseable timestamp last instead of throwing", () => {
    const activity = getProjectActivity(
      [project("bad", "ready", 0, "not-a-date"), project("good", "ready", 0, daysAgo(1))],
      [],
    );

    expect(getRecentProjects(activity).map(({ project: { id } }) => id)).toEqual(["good", "bad"]);
  });
});

describe("getProfileStats", () => {
  const activity = getProjectActivity(projects, learningData);

  it("derives every figure from the user's projects and learning", () => {
    expect(
      getProfileStats({ activity, learning: learningData, hasProjects: true, hasLearning: true, now: NOW }),
    ).toEqual({
      totalProjects: 4,
      // "fresh" (created 1h ago) and "studied" (topic 2h ago); "done" was studied 15 days ago.
      recentProjects: 2,
      // An empty curriculum is not a learning path.
      learningPaths: 2,
      // Generating, or ready with learning left; never failed or finished.
      inProgress: 2,
    });
  });

  it("reports zeros, not unavailable, for a loaded empty workspace", () => {
    expect(getProfileStats({ activity: [], learning: [], hasProjects: true, hasLearning: true, now: NOW })).toEqual({
      totalProjects: 0,
      recentProjects: 0,
      learningPaths: 0,
      inProgress: 0,
    });
  });

  it("leaves figures unavailable when their data has not loaded", () => {
    expect(getProfileStats({ activity, learning: [], hasProjects: true, hasLearning: false, now: NOW })).toEqual({
      totalProjects: 4,
      recentProjects: null,
      learningPaths: null,
      inProgress: 2,
    });
    expect(getProfileStats({ activity: [], learning: learningData, hasProjects: false, hasLearning: true, now: NOW }))
      .toEqual({ totalProjects: null, recentProjects: null, learningPaths: 2, inProgress: null });
  });
});
