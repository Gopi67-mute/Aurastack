import type { Project, ProjectStatus } from "../types/projects";
import { getProjectCaption, getProjectStatusLabel } from "./projectDisplay";

// The real module also exports lucide icons, whose ESM build Jest does not
// transform; only the labels are needed here.
jest.mock("../../create-project/constants/platforms", () => ({
  PLATFORM_LABELS: { android: "Android", ios: "iOS", web: "Web" },
}));

function project(status: ProjectStatus): Project {
  return { id: "p", name: "Storefront", status, progress: 0, createdAt: "2026-10-01T00:00:00.000Z" };
}

describe("project lifecycle display", () => {
  it("labels generating and failed projects", () => {
    expect(getProjectStatusLabel(project("generating"))).toBe("Generating your project…");
    expect(getProjectStatusLabel(project("failed"))).toBe("Generation failed");
    expect(getProjectStatusLabel(project("ready"))).toBeNull();
  });

  it("appends the lifecycle label to the created caption only while it applies", () => {
    expect(getProjectCaption(project("generating"), "today")).toBe(
      "Created today · Generating your project…",
    );
    expect(getProjectCaption(project("failed"), "today")).toBe("Created today · Generation failed");
    expect(getProjectCaption(project("ready"), "today")).toBe("Created today");
  });
});
