import { act, render, screen } from "@testing-library/react-native";

import type { Project, ProjectStatus } from "../../projects/types/projects";
import { blueprintContent } from "../__fixtures__/blueprint";
import { useProjectBlueprint } from "../hooks/useProjectBlueprint";
import { generateProjectBlueprint } from "../services/generateProjectBlueprint";
import { getProjectBlueprint } from "../services/getProjectBlueprint";
import type { WorkspaceSectionKey } from "../types/workspace";
import { WorkspaceSectionPanel } from "./WorkspaceSectionPanel";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));
jest.mock("../services/getProjectBlueprint", () => ({ getProjectBlueprint: jest.fn() }));
jest.mock("../services/generateProjectBlueprint", () => ({ generateProjectBlueprint: jest.fn() }));
// Learning reads its own stores; only whether it shows matters here.
jest.mock("../../learning/components/ProjectLearningPanel", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { ProjectLearningPanel: () => <Text>Learning panel</Text> };
});
jest.mock("../hooks/useProjectBlueprint", () => ({ useProjectBlueprint: jest.fn() }));

const mockUseProjectBlueprint = jest.mocked(useProjectBlueprint);

function project(status: ProjectStatus): Project {
  return {
    id: "p1",
    name: "Storefront",
    status,
    progress: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    // User input: must never be shown as the recommended stack.
    techStack: ["User Picked Tech"],
  };
}

function renderPanel(status: ProjectStatus, section: WorkspaceSectionKey) {
  return render(<WorkspaceSectionPanel project={project(status)} section={section} />);
}

/** Whether the panel asked the hook to follow the blueprint on its latest render. */
const blueprintEnabled = () => mockUseProjectBlueprint.mock.lastCall?.[1];

beforeEach(() => {
  mockUseProjectBlueprint.mockReset().mockReturnValue({
    status: "generating",
    blueprint: null,
    error: null,
    retry: jest.fn(),
    refresh: jest.fn(),
  });
});

describe("WorkspaceSectionPanel", () => {
  it("never follows the blueprint while Learning is open", () => {
    renderPanel("ready", "learning");

    expect(screen.getByText("Learning panel")).toBeTruthy();
    expect(blueprintEnabled()).toBe(false);
  });

  it("heads Learning with its own accent and points to the roadmap", () => {
    renderPanel("ready", "learning");

    expect(screen.getByRole("header", { name: "Learning" })).toBeTruthy();
    expect(screen.getByText("Each topic is applied in a phase of your Roadmap.")).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain("bg-section-learning/10");
  });

  it.each([
    ["techStack", "bg-section-tech/10"],
    ["roadmap", "bg-section-roadmap/10"],
    ["architecture", "bg-section-architecture/10"],
  ] as const)("heads %s with its own accent", (section, tint) => {
    renderPanel("generating", section);

    const markup = JSON.stringify(screen.toJSON());
    expect(markup).toContain(tint);
    expect(markup).not.toContain("bg-aura-purple/15");
  });

  it.each(["techStack", "architecture", "roadmap"] as const)(
    "follows the blueprint of a ready project on %s",
    (section) => {
      renderPanel("ready", section);

      expect(mockUseProjectBlueprint).toHaveBeenLastCalledWith("p1", true);
      expect(screen.getByText("Designing your blueprint…")).toBeTruthy();
    },
  );

  it.each(["generating", "failed"] as const)("keeps a %s project's sections preparing", (status) => {
    renderPanel(status, "techStack");

    expect(blueprintEnabled()).toBe(false);
    expect(screen.getByText("Preparing...")).toBeTruthy();
  });

  it("no longer shows the user-entered stack as the tech stack", () => {
    renderPanel("ready", "techStack");

    expect(screen.queryByText("User Picked Tech")).toBeNull();
  });

  it("stops following the blueprint when switching to Learning", () => {
    const { rerender } = renderPanel("ready", "techStack");
    expect(blueprintEnabled()).toBe(true);

    rerender(<WorkspaceSectionPanel project={project("ready")} section="learning" />);

    expect(blueprintEnabled()).toBe(false);
  });
});

describe("WorkspaceSectionPanel with the real blueprint hook", () => {
  const mockGet = jest.mocked(getProjectBlueprint);
  const mockPost = jest.mocked(generateProjectBlueprint);
  const READY = {
    status: "ready" as const,
    generatedAt: "2026-10-06T00:00:00.000Z",
    blueprint: blueprintContent(),
  };

  const flush = () => act(async () => {});

  beforeEach(() => {
    const actual = jest.requireActual<typeof import("../hooks/useProjectBlueprint")>("../hooks/useProjectBlueprint");
    mockUseProjectBlueprint.mockImplementation(actual.useProjectBlueprint);
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it("generates once on the first blueprint section and reuses it across sections", async () => {
    mockGet.mockResolvedValueOnce({ status: "missing", blueprint: null, generatedAt: null });
    mockPost.mockResolvedValue({ status: "generating", blueprint: null, generatedAt: null });
    const { rerender } = render(<WorkspaceSectionPanel project={project("ready")} section="learning" />);
    await flush();
    expect(mockGet).not.toHaveBeenCalled();

    rerender(<WorkspaceSectionPanel project={project("ready")} section="techStack" />);
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Designing your blueprint…")).toBeTruthy();

    rerender(<WorkspaceSectionPanel project={project("ready")} section="architecture" />);
    rerender(<WorkspaceSectionPanel project={project("ready")} section="roadmap" />);
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("renders each ready section from one read", async () => {
    mockGet.mockResolvedValue(READY);
    const { rerender } = render(<WorkspaceSectionPanel project={project("ready")} section="techStack" />);
    await flush();
    expect(screen.getByText("React Native")).toBeTruthy();

    rerender(<WorkspaceSectionPanel project={project("ready")} section="architecture" />);
    expect(screen.getByText("Layered")).toBeTruthy();

    rerender(<WorkspaceSectionPanel project={project("ready")} section="roadmap" />);
    expect(screen.getByText("Foundation")).toBeTruthy();

    rerender(<WorkspaceSectionPanel project={project("ready")} section="learning" />);
    await flush();
    expect(screen.getByText("Learning panel")).toBeTruthy();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("makes no request for a project that is not ready", async () => {
    render(<WorkspaceSectionPanel project={project("generating")} section="techStack" />);
    await flush();

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
