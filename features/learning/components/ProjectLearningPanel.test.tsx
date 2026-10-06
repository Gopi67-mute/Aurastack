import { fireEvent, render, screen } from "@testing-library/react-native";

import type { RemoteStatus } from "../../../lib/remoteData";
import { useProjectById } from "../../project-workspace/hooks/useProjectById";
import type { Project, ProjectStatus } from "../../projects/types/projects";
import { useLearningData } from "../hooks/useLearningData";
import { useProjectLearning } from "../hooks/useProjectLearning";
import type { ProjectLearning } from "../types/learning";
import { summarizeTopics } from "../utils/summarizeTopics";
import { ProjectLearningPanel } from "./ProjectLearningPanel";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("../hooks/useProjectLearning", () => ({ useProjectLearning: jest.fn() }));
jest.mock("../hooks/useLearningData", () => ({ useLearningData: jest.fn() }));
jest.mock("../../project-workspace/hooks/useProjectById", () => ({ useProjectById: jest.fn() }));

const mockUseProjectLearning = jest.mocked(useProjectLearning);
const mockUseLearningData = jest.mocked(useLearningData);
const mockUseProjectById = jest.mocked(useProjectById);
const mockRefresh = jest.fn(() => Promise.resolve());

const PROJECT_ID = "p1";

function learning(topicCount: number): ProjectLearning {
  return {
    projectId: PROJECT_ID,
    projectName: "Storefront",
    createdAt: "2026-10-01T00:00:00.000Z",
    topics: Array.from({ length: topicCount }, (_, index) => ({
      id: `t${index}`,
      projectId: PROJECT_ID,
      title: `Topic ${index}`,
      description: "d",
      order: index + 1,
      status: "not_started" as const,
      content: { what: "w", why: "y", how: "h", example: "e", apply: "a" },
    })),
  };
}

function given({
  learningEntry,
  learningStatus = "ready",
  projectStatus,
  projectsStatus = "ready",
}: {
  learningEntry?: ProjectLearning;
  learningStatus?: RemoteStatus;
  projectStatus?: ProjectStatus;
  projectsStatus?: RemoteStatus;
}) {
  const topics = learningEntry?.topics ?? [];
  mockUseProjectLearning.mockReturnValue({
    project: learningEntry,
    summary: summarizeTopics(topics),
    nextTopic: topics[0],
    status: learningStatus,
    error: null,
  });
  const project: Project | undefined = projectStatus
    ? { id: PROJECT_ID, name: "Storefront", status: projectStatus, progress: 0, createdAt: "x" }
    : undefined;
  mockUseProjectById.mockReturnValue({ project, status: projectsStatus, error: null, refresh: mockRefresh });
  mockUseLearningData.mockReturnValue({ data: [], status: learningStatus, error: null, refresh: mockRefresh });
}

beforeEach(() => {
  mockPush.mockReset();
  mockRefresh.mockClear();
});

describe("ProjectLearningPanel generation states", () => {
  it("shows generating while the project generates", () => {
    given({ learningEntry: learning(0), projectStatus: "generating" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("Generating your learning plan…")).toBeTruthy();
  });

  it("shows generating, not 'not found', before the project reaches the learning list", () => {
    given({ learningEntry: undefined, projectStatus: "generating" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("Generating your learning plan…")).toBeTruthy();
    expect(screen.queryByText("We could not find learning topics for this project.")).toBeNull();
  });

  it("shows generating even while learning is still loading", () => {
    given({ learningEntry: undefined, learningStatus: "loading", projectStatus: "generating" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("Generating your learning plan…")).toBeTruthy();
  });

  it("explains a failed generation and points at the workspace retry card", () => {
    given({ learningEntry: learning(0), projectStatus: "failed" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("We couldn't generate this learning plan.")).toBeTruthy();
    expect(screen.getByText(/Use Try again above/)).toBeTruthy();
    expect(screen.queryByLabelText("Open project to try again")).toBeNull();
  });

  it("links a failed generation to its project outside the workspace", () => {
    given({ learningEntry: learning(0), projectStatus: "failed" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} linkToProject />);

    fireEvent.press(screen.getByLabelText("Open project to try again"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/projects/[projectId]",
      params: { projectId: PROJECT_ID },
    });
  });

  it("reports a ready project with no topics as an error and offers a reload", () => {
    given({ learningEntry: learning(0), projectStatus: "ready" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText(/unexpectedly empty/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Try again"));
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("shows loading, not an error, while a just-ready project's topics are reloading", () => {
    given({ learningEntry: learning(0), learningStatus: "loading", projectStatus: "ready" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByLabelText("Loading learning topics")).toBeTruthy();
    expect(screen.queryByText(/unexpectedly empty/)).toBeNull();
  });

  it("reports a ready project missing from the learning list the same way", () => {
    given({ learningEntry: undefined, projectStatus: "ready" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText(/unexpectedly empty/)).toBeTruthy();
  });

  it("waits for the project status before judging an empty plan", () => {
    given({ learningEntry: learning(0), projectStatus: undefined, projectsStatus: "loading" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByLabelText("Loading learning topics")).toBeTruthy();
    expect(screen.queryByText(/unexpectedly empty/)).toBeNull();
  });

  it("says not found only when neither learning nor the project exist", () => {
    given({ learningEntry: undefined, projectStatus: undefined });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("We could not find learning topics for this project.")).toBeTruthy();
  });

  it("lists the topics of a ready project", () => {
    given({ learningEntry: learning(2), projectStatus: "ready" });
    render(<ProjectLearningPanel projectId={PROJECT_ID} />);

    expect(screen.getByText("Topics")).toBeTruthy();
    expect(screen.queryByText(/unexpectedly empty/)).toBeNull();
    expect(screen.queryByText("Generating your learning plan…")).toBeNull();
  });
});
