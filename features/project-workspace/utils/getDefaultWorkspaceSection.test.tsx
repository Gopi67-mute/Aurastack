import { fireEvent, render, screen } from "@testing-library/react-native";

import ProjectWorkspace from "../../../app/projects/[projectId]";
import type { Project, ProjectStatus } from "../../projects/types/projects";
import { useProjectById } from "../hooks/useProjectById";
import { getDefaultWorkspaceSection } from "./getDefaultWorkspaceSection";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ projectId: "p1" }),
}));
jest.mock("../hooks/useProjectById", () => ({ useProjectById: jest.fn() }));
// The panels and the retry card read their own stores; only which one shows matters here.
jest.mock("../components/WorkspaceSectionPanel", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    WorkspaceSectionPanel: ({ section }: { section: string }) => <Text>{`panel:${section}`}</Text>,
  };
});
jest.mock("../components/GenerationFailedCard", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { GenerationFailedCard: () => <Text>Generation failed card</Text> };
});

const refresh = () => Promise.resolve();

function given(status: ProjectStatus) {
  const project: Project = {
    id: "p1",
    name: "Storefront",
    status,
    progress: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    iconKey: null,
  };
  jest.mocked(useProjectById).mockReturnValue({ project, status: "ready", error: null, refresh });
}

const selectedTab = () => screen.getByRole("tab", { selected: true });

describe("getDefaultWorkspaceSection", () => {
  it("opens a ready project on its learning plan", () => {
    expect(getDefaultWorkspaceSection("ready")).toBe("learning");
  });

  it.each(["generating", "failed", undefined] as const)("keeps the tech stack for %s", (status) => {
    expect(getDefaultWorkspaceSection(status)).toBe("techStack");
  });
});

describe("project workspace opening section", () => {
  it("opens a ready project on the Learning tab", () => {
    given("ready");
    render(<ProjectWorkspace />);

    expect(selectedTab()).toHaveProp("accessibilityLabel", "Learning");
    expect(screen.getByText("panel:learning")).toBeTruthy();
  });

  it("keeps a generating project on the Tech Stack tab", () => {
    given("generating");
    render(<ProjectWorkspace />);

    expect(selectedTab()).toHaveProp("accessibilityLabel", "Tech Stack");
    expect(screen.queryByText("Generation failed card")).toBeNull();
  });

  it("keeps a failed project on the Tech Stack tab with its retry card", () => {
    given("failed");
    render(<ProjectWorkspace />);

    expect(selectedTab()).toHaveProp("accessibilityLabel", "Tech Stack");
    expect(screen.getByText("Generation failed card")).toBeTruthy();
  });

  it("moves to Learning when a generating project turns ready, unless the user picked a tab", () => {
    given("generating");
    const { rerender } = render(<ProjectWorkspace />);

    given("ready");
    rerender(<ProjectWorkspace />);
    expect(selectedTab()).toHaveProp("accessibilityLabel", "Learning");

    fireEvent.press(screen.getByRole("tab", { name: "Roadmap" }));
    rerender(<ProjectWorkspace />);
    expect(selectedTab()).toHaveProp("accessibilityLabel", "Roadmap");
  });
});
