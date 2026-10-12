import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import Profile from "../../../app/(tabs)/profile";
import appConfig from "../../../app.json";
import { resetUserStores } from "../../../store/resetUserStores";
import { useProjectStore } from "../../../store/useProjectStore";
import { getLearning } from "../../learning/services/getLearning";
import type { LearningTopic, ProjectLearning } from "../../learning/types/learning";
import { getProjects } from "../../projects/services/getProjects";
import type { Project, ProjectStatus } from "../../projects/types/projects";

jest.mock("../../projects/services/getProjects", () => ({ getProjects: jest.fn() }));
jest.mock("../../learning/services/getLearning", () => ({ getLearning: jest.fn() }));

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// A build embeds app.json's "expo" config; jest-expo's default mock has no version.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: jest.requireActual("../../../app.json").expo },
}));
const mockRouter = { navigate: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

interface MockUser {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  hasImage: boolean;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
}
let mockUser: MockUser | null = null;
let mockIsSignedIn: boolean | undefined = true;
const mockSignOut = jest.fn<Promise<void>, []>();
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ isSignedIn: mockIsSignedIn, getToken: () => Promise.resolve("token") }),
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: mockUser }),
}));

const mockGetProjects = jest.mocked(getProjects);
const mockGetLearning = jest.mocked(getLearning);

const NOW = Date.now();
const hoursAgo = (hours: number) => new Date(NOW - hours * 60 * 60 * 1000).toISOString();

function user(overrides: Partial<MockUser> = {}): MockUser {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    fullName: "Ada Lovelace",
    username: null,
    hasImage: false,
    imageUrl: "https://img.example.com/default.png",
    primaryEmailAddress: { emailAddress: "ada.lovelace.long.address@example.com" },
    ...overrides,
  };
}

function project(id: string, name: string, status: ProjectStatus, progress: number, createdAt: string): Project {
  return { id, name, status, progress, createdAt };
}

function learning(projectId: string, completedAt: string | null): ProjectLearning {
  const topic: LearningTopic = {
    id: "t1",
    projectId,
    title: "Topic",
    description: "",
    order: 1,
    status: completedAt ? "completed" : "not_started",
    completedAt,
    content: { what: "", why: "", how: "", example: "", apply: "" },
  };
  return { projectId, projectName: projectId, createdAt: hoursAgo(24 * 30), topics: [topic] };
}

const WORKSPACE_PROJECTS = [
  project("p-fitness", "Fitness Tracker", "generating", 0, hoursAgo(1)),
  project("p-recipe", "Recipe Box", "ready", 40, hoursAgo(24 * 10)),
  project("p-social", "Social Dashboard", "ready", 100, hoursAgo(24 * 20)),
  project("p-broken", "Broken Idea", "failed", 0, hoursAgo(24 * 40)),
];
const WORKSPACE_LEARNING = [learning("p-recipe", hoursAgo(2)), learning("p-social", hoursAgo(24 * 15))];

/** Renders Profile and lets the store loads settle. */
async function renderProfile(): Promise<void> {
  render(<Profile />);
  await act(async () => {});
}

let alertButtons: AlertButton[] = [];
function pressAlertButton(text: string): Promise<void> {
  return act(async () => {
    alertButtons.find((button) => button.text === text)?.onPress?.();
  });
}

beforeEach(() => {
  for (const mock of [mockGetProjects, mockGetLearning, mockSignOut, ...Object.values(mockRouter)]) mock.mockReset();
  mockUser = user();
  mockIsSignedIn = true;
  mockGetProjects.mockResolvedValue(WORKSPACE_PROJECTS);
  mockGetLearning.mockResolvedValue(WORKSPACE_LEARNING);
  alertButtons = [];
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    alertButtons = buttons ?? [];
  });
  resetUserStores();
});

afterEach(() => {
  resetUserStores();
  jest.restoreAllMocks();
});

describe("Profile identity", () => {
  it("shows the signed-in user's name, initials and email", async () => {
    await renderProfile();

    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.getByText("ada.lovelace.long.address@example.com")).toBeTruthy();
    expect(screen.getByLabelText("Avatar, AL")).toBeTruthy();
  });

  it("shows a real photo instead of the initials when the user has one", async () => {
    mockUser = user({ hasImage: true, imageUrl: "https://img.example.com/ada.png" });
    await renderProfile();

    expect(screen.getByLabelText("Your profile photo")).toBeTruthy();
    expect(screen.queryByText("AL")).toBeNull();
  });

  it("falls back to the email when no name is set, and never claims presence", async () => {
    mockUser = user({ firstName: null, lastName: null, fullName: null });
    await renderProfile();

    expect(screen.getByText("ada.lovelace.long.address")).toBeTruthy();
    expect(screen.getByLabelText("Avatar, A")).toBeTruthy();
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("handles a missing user without a broken avatar", async () => {
    mockUser = null;
    await renderProfile();

    expect(screen.getByText("Your account")).toBeTruthy();
    expect(screen.getByLabelText("Avatar, no initials")).toBeTruthy();
  });
});

describe("Profile workspace", () => {
  it("derives the statistics from the user's projects and learning", async () => {
    await renderProfile();

    expect(screen.getByLabelText("Total Projects, 4")).toBeTruthy();
    // Created 1h ago, and studied 2h ago; the 15-day-old study session is not recent.
    expect(screen.getByLabelText("Recent Projects, 2")).toBeTruthy();
    expect(screen.getByLabelText("Learning Paths, 2")).toBeTruthy();
    // Generating, plus ready at 40%; finished and failed projects are not.
    expect(screen.getByLabelText("In Progress, 2")).toBeTruthy();
  });

  it("lists the most recently active projects with labelled timestamps", async () => {
    await renderProfile();

    const rows = screen.getAllByLabelText(/^(Fitness Tracker|Recipe Box|Social Dashboard|Broken Idea),/);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual([
      "Fitness Tracker, Created 1 hour ago",
      "Recipe Box, Last studied 2 hours ago",
      "Social Dashboard, Last studied 2 weeks ago",
    ]);
  });

  it("opens the pressed project by its id, and View all opens Projects", async () => {
    await renderProfile();

    fireEvent.press(screen.getByLabelText("Recipe Box, Last studied 2 hours ago"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/projects/[projectId]",
      params: { projectId: "p-recipe" },
    });

    fireEvent.press(screen.getByLabelText("View all projects"));
    expect(mockRouter.navigate).toHaveBeenCalledWith("/projects");
  });

  it("shows an empty state with a way to create the first project", async () => {
    mockGetProjects.mockResolvedValue([]);
    mockGetLearning.mockResolvedValue([]);
    await renderProfile();

    expect(screen.getByLabelText("Total Projects, 0")).toBeTruthy();
    expect(screen.getByText("No projects yet. Your most recent projects will show up here.")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Create a project"));
    expect(mockRouter.push).toHaveBeenCalledWith("/create-project");
  });

  it("shows loading while the first read is in flight, with sign-out still available", async () => {
    mockGetProjects.mockReturnValue(new Promise(() => {}));
    await renderProfile();

    expect(screen.getByLabelText("Loading your workspace")).toBeTruthy();
    expect(screen.getByLabelText("Sign out")).toBeTruthy();
  });

  it("reports a failed read as unavailable, not as an empty workspace, and retries", async () => {
    mockGetProjects.mockRejectedValueOnce(new Error("network"));
    await renderProfile();

    expect(screen.getByText("Couldn't load your projects.")).toBeTruthy();
    expect(screen.getByLabelText("Total Projects, not available")).toBeTruthy();
    expect(screen.getByLabelText("In Progress, not available")).toBeTruthy();
    expect(screen.queryByText(/No projects yet/)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Try again"));
    });
    expect(screen.getByLabelText("Total Projects, 4")).toBeTruthy();
  });
});

describe("Profile settings", () => {
  it("presents no unsupported plan, presence or settings actions", async () => {
    await renderProfile();

    for (const text of ["Upgrade", "Free Plan", "Edit Profile", "Appearance", "Help & Feedback"]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });

  it("shows privacy and the configured app version as information, not buttons", async () => {
    await renderProfile();

    expect(screen.getByText("Privacy & Security")).toBeTruthy();
    expect(screen.getByText(`Version ${appConfig.expo.version}`)).toBeTruthy();
    const buttonLabels = screen.getAllByRole("button").map((button) => button.props.accessibilityLabel);
    expect(buttonLabels.filter((label) => /privacy|about|version/i.test(label ?? ""))).toEqual([]);
  });
});

describe("Profile sign-out", () => {
  it("asks for confirmation, and cancelling keeps the user signed in with their data", async () => {
    await renderProfile();

    fireEvent.press(screen.getByLabelText("Sign out"));
    expect(Alert.alert).toHaveBeenCalledWith("Sign out?", expect.any(String), expect.any(Array));

    await pressAlertButton("Cancel");

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(useProjectStore.getState().projects).toHaveLength(4);
    expect(screen.getByLabelText("Total Projects, 4")).toBeTruthy();
  });

  it("confirming signs out through Clerk once, clears the data, then leaves for sign-in", async () => {
    mockSignOut.mockResolvedValue();
    await renderProfile();

    fireEvent.press(screen.getByLabelText("Sign out"));
    await pressAlertButton("Sign Out");
    // A second tap while signing out does nothing.
    fireEvent.press(screen.getByLabelText("Sign out"));
    await pressAlertButton("Sign Out");

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(screen.queryByText("Recipe Box")).toBeNull();

    mockIsSignedIn = false;
    screen.rerender(<Profile />);
    expect(mockRouter.replace.mock.calls).toEqual([["/sign-in"]]);
  });

  it("shows the next account only its own data after signing back in", async () => {
    mockSignOut.mockResolvedValue();
    await renderProfile();
    fireEvent.press(screen.getByLabelText("Sign out"));
    await pressAlertButton("Sign Out");
    screen.unmount();

    mockUser = user({ firstName: "Grace", lastName: "Hopper", primaryEmailAddress: { emailAddress: "grace@example.com" } });
    mockGetProjects.mockResolvedValue([project("p-compiler", "Compiler", "ready", 10, hoursAgo(3))]);
    mockGetLearning.mockResolvedValue([learning("p-compiler", null)]);
    await renderProfile();

    expect(screen.getByText("Grace")).toBeTruthy();
    expect(screen.getByText("GH")).toBeTruthy();
    expect(screen.getByLabelText("Total Projects, 1")).toBeTruthy();
    expect(screen.getByText("Compiler")).toBeTruthy();
    for (const name of ["Fitness Tracker", "Recipe Box", "Social Dashboard"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });
});
