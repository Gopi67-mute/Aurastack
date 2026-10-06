import { fireEvent, render, screen } from "@testing-library/react-native";

import LearningTopicScreen from "../../../app/learning/[projectId]/[topicId]";
import { useLearningTopic } from "../hooks/useLearningTopic";
import type { LearningTopic, ProjectLearning, TopicStatus } from "../types/learning";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockReplace = jest.fn();
const mockParams = { projectId: "p1", topicId: "t1" };
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("../hooks/useLearningTopic", () => ({ useLearningTopic: jest.fn() }));

function topic(id: string, order: number, status: TopicStatus): LearningTopic {
  return {
    id,
    projectId: "p1",
    title: `Topic ${order}`,
    description: "d",
    order,
    status,
    completedAt: status === "completed" ? "2026-10-06T09:00:00+00:00" : null,
    content: { what: "w", why: "y", how: "h", example: "e", apply: "a", miniTask: null },
  };
}

function given(statuses: TopicStatus[], current = 0) {
  const topics = statuses.map((status, index) => topic(`t${index + 1}`, index + 1, status));
  const project: ProjectLearning = {
    projectId: "p1",
    projectName: "Storefront",
    iconKey: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    topics,
  };
  jest.mocked(useLearningTopic).mockReturnValue({
    project,
    topic: topics[current],
    status: "ready",
    error: null,
    isCompleting: false,
    completeError: null,
    markCompleted: jest.fn(() => Promise.resolve()),
  });
}

beforeEach(() => {
  mockReplace.mockReset();
});

describe("topic screen after completion", () => {
  it("offers no continuation before the topic is completed", () => {
    given(["in_progress", "not_started"]);
    render(<LearningTopicScreen />);

    expect(screen.queryByText(/^Next:/)).toBeNull();
    expect(screen.queryByText("All topics completed")).toBeNull();
  });

  it("offers the next topic once completed and replaces the screen with it", () => {
    given(["completed", "not_started", "not_started"]);
    render(<LearningTopicScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Next: Topic 2" }));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/learning/[projectId]/[topicId]",
      params: { projectId: "p1", topicId: "t2" },
    });
    expect(screen.queryByText("All topics completed")).toBeNull();
  });

  it("leads back to the plan once the final topic is completed", () => {
    given(["completed", "completed"], 1);
    render(<LearningTopicScreen />);

    expect(screen.getByText("All topics completed")).toBeTruthy();
    expect(screen.queryByText(/^Next:/)).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Back to plan" }));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/learning/[projectId]",
      params: { projectId: "p1" },
    });
  });

  it("omits the mini task section when the backend sends null", () => {
    given(["in_progress"]);
    render(<LearningTopicScreen />);

    expect(screen.getByText("What is it?")).toBeTruthy();
    expect(screen.queryByText("Mini task (optional)")).toBeNull();
  });
});
