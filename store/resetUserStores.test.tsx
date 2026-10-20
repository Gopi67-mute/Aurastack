import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import Profile from "../app/(tabs)/profile";
import { getLearning } from "../features/learning/services/getLearning";
import type { ProjectLearning } from "../features/learning/types/learning";
import { getMomentum } from "../features/progress/services/getMomentum";
import type { MomentumState } from "../features/progress/types/progress";
import { getProjects } from "../features/projects/services/getProjects";
import type { Project } from "../features/projects/types/projects";
import { resetUserStores } from "./resetUserStores";
import { useLearningStore } from "./useLearningStore";
import { useMomentumStore } from "./useMomentumStore";
import { GENERATION_POLL_INTERVAL_MS, useProjectStore } from "./useProjectStore";

jest.mock("../features/projects/services/getProjects", () => ({ getProjects: jest.fn() }));
jest.mock("../features/learning/services/getLearning", () => ({ getLearning: jest.fn() }));
jest.mock("../features/progress/services/getMomentum", () => ({ getMomentum: jest.fn() }));

// Profile screen dependencies.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockReplace = jest.fn<void, [string]>();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
const mockSignOut = jest.fn<Promise<void>, []>();
let mockIsSignedIn: boolean | undefined = true;
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ isSignedIn: mockIsSignedIn, getToken: () => Promise.resolve("token") }),
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: null }),
}));

const mockGetProjects = jest.mocked(getProjects);
const mockGetLearning = jest.mocked(getLearning);
const mockGetMomentum = jest.mocked(getMomentum);
const getToken = () => Promise.resolve("token");

function project(id: string): Project {
  return { id, name: id, status: "generating", progress: 0, createdAt: "2026-10-01T00:00:00.000Z" };
}

function learning(projectId: string): ProjectLearning {
  return { projectId, projectName: projectId, createdAt: "2026-10-01T00:00:00.000Z", topics: [] };
}

const momentum = (streak: number) => ({ currentStreak: streak }) as unknown as MomentumState;

async function signInAndLoad(user: string): Promise<void> {
  mockGetProjects.mockResolvedValue([project(`${user}-project`)]);
  mockGetLearning.mockResolvedValue([learning(`${user}-project`)]);
  mockGetMomentum.mockResolvedValue(momentum(user === "a" ? 5 : 1));
  await useProjectStore.getState().load(getToken);
  await useLearningStore.getState().load(getToken);
  await useMomentumStore.getState().load(getToken);
}

function expectEmptyStores(): void {
  expect(useProjectStore.getState()).toMatchObject({ projects: [], status: "idle", error: null });
  expect(useLearningStore.getState()).toMatchObject({
    learning: [],
    status: "idle",
    error: null,
    openedTopics: {},
  });
  expect(useMomentumStore.getState()).toMatchObject({ momentum: null, status: "idle", error: null });
}

beforeEach(() => {
  jest.useFakeTimers();
  for (const mock of [mockGetProjects, mockGetLearning, mockGetMomentum, mockSignOut]) mock.mockReset();
  mockReplace.mockReset();
  mockIsSignedIn = true;
  // Profile reads the stores on mount; an unloaded user has no projects yet.
  mockGetProjects.mockResolvedValue([]);
  mockGetLearning.mockResolvedValue([]);
  // Profile asks before signing out; these tests confirm (cancel is covered
  // in features/profile/components/ProfileScreen.test.tsx).
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === "destructive")?.onPress?.();
  });
  resetUserStores();
});

afterEach(() => {
  resetUserStores();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("resetUserStores", () => {
  it("clears user A's data and polling, and user B then loads fresh", async () => {
    await signInAndLoad("a");
    useLearningStore.getState().markOpened("a-project", "t1");
    expect(useProjectStore.getState().projects).toHaveLength(1);

    resetUserStores();

    expectEmptyStores();
    // User A's project was generating; its polling must not survive sign-out.
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS * 5);
    expect(mockGetProjects).toHaveBeenCalledTimes(1);

    await signInAndLoad("b");

    expect(mockGetProjects).toHaveBeenCalledTimes(2);
    expect(mockGetLearning).toHaveBeenCalledTimes(2);
    expect(mockGetMomentum).toHaveBeenCalledTimes(2);
    expect(useProjectStore.getState().projects.map(({ id }) => id)).toEqual(["b-project"]);
    expect(useLearningStore.getState().learning.map(({ projectId }) => projectId)).toEqual(["b-project"]);
    expect(useMomentumStore.getState().momentum).toEqual(momentum(1));
  });

  it("drops user A's responses that arrive after sign-out", async () => {
    let answerProjects: (value: Project[]) => void = () => {};
    let answerLearning: (value: ProjectLearning[]) => void = () => {};
    let answerMomentum: (value: MomentumState) => void = () => {};
    mockGetProjects.mockReturnValueOnce(new Promise((resolve) => (answerProjects = resolve)));
    mockGetLearning.mockReturnValueOnce(new Promise((resolve) => (answerLearning = resolve)));
    mockGetMomentum.mockReturnValueOnce(new Promise((resolve) => (answerMomentum = resolve)));
    const loads = [
      useProjectStore.getState().load(getToken),
      useLearningStore.getState().load(getToken, true),
      useMomentumStore.getState().load(getToken),
    ];

    resetUserStores();
    answerProjects([project("a-project")]);
    answerLearning([learning("a-project")]);
    answerMomentum(momentum(5));
    await Promise.all(loads);
    await jest.advanceTimersByTimeAsync(GENERATION_POLL_INTERVAL_MS * 5);

    expectEmptyStores();
    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });
});

describe("Profile sign-out", () => {
  it("resets the stores once sign-out succeeds", async () => {
    await signInAndLoad("a");
    mockSignOut.mockResolvedValueOnce();
    render(<Profile />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Sign out"));
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expectEmptyStores();
  });

  it("keeps the user's data when sign-out fails", async () => {
    await signInAndLoad("a");
    mockSignOut.mockRejectedValueOnce(new Error("network"));
    render(<Profile />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Sign out"));
    });

    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(screen.getByText("Something went wrong signing out. Please try again.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces straight to sign-in, once, after Clerk reports signed-out", async () => {
    await signInAndLoad("a");
    mockSignOut.mockResolvedValueOnce();
    render(<Profile />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Sign out"));
    });
    // signOut resolved, but Clerk still reports the old session: wait for it.
    expect(mockReplace).not.toHaveBeenCalled();

    mockIsSignedIn = false;
    screen.rerender(<Profile />);
    screen.rerender(<Profile />);
    await act(async () => {
      await jest.runOnlyPendingTimersAsync();
    });

    // No hop through "/" (whose <Redirect> stacked a second replace).
    expect(mockReplace.mock.calls).toEqual([["/sign-in"]]);
    expectEmptyStores();
  });

  it("does not navigate when Clerk is already signed out but sign-out has not finished", async () => {
    let finishSignOut: () => void = () => {};
    mockSignOut.mockReturnValueOnce(new Promise((resolve) => (finishSignOut = resolve)));
    render(<Profile />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Sign out"));
    });
    mockIsSignedIn = false;
    screen.rerender(<Profile />);
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      finishSignOut();
    });
    expect(mockReplace.mock.calls).toEqual([["/sign-in"]]);
  });
});
