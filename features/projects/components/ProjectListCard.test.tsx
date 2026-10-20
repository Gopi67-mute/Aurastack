import { render, screen } from "@testing-library/react-native";

import type { Project, ProjectStatus } from "../types/projects";
import { ProjectListCard } from "./ProjectListCard";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../home/utils/formatRelativeTime", () => ({ formatRelativeTime: () => "today" }));

function project(status: ProjectStatus): Project {
  return { id: "p", name: "Project X", status, progress: 40, createdAt: "2026-10-01T00:00:00.000Z" };
}

describe("ProjectListCard accessibility", () => {
  it.each([
    ["generating", "Generating"],
    ["ready", "Ready"],
    ["failed", "Generation failed"],
  ] as const)("announces a %s project's status", (status, spoken) => {
    render(<ProjectListCard project={project(status)} onPress={() => {}} />);

    expect(screen.getByLabelText(`Project X, ${spoken}, 40% complete, created today`)).toBeTruthy();
  });
});
