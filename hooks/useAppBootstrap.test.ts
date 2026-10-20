import { act, renderHook } from "@testing-library/react-native";

import { getOnboardingCompleted } from "../lib/onboardingStorage";
import { SAFETY_TIMEOUT_MS, useAppBootstrap } from "./useAppBootstrap";

let mockFontsLoaded = true;
let mockAuth: { isLoaded: boolean; isSignedIn: boolean | undefined } = {
  isLoaded: true,
  isSignedIn: true,
};
let mockClerkStatus = "ready";

jest.mock("expo-font", () => ({ useFonts: () => [mockFontsLoaded, null] }));
jest.mock("@clerk/expo", () => ({
  useAuth: () => mockAuth,
  useClerk: () => ({ status: mockClerkStatus }),
}));
jest.mock("../lib/onboardingStorage", () => ({ getOnboardingCompleted: jest.fn() }));

const mockGetOnboardingCompleted = jest.mocked(getOnboardingCompleted);
let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  mockFontsLoaded = true;
  mockAuth = { isLoaded: true, isSignedIn: true };
  mockClerkStatus = "ready";
  mockGetOnboardingCompleted.mockReset().mockResolvedValue(true);
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  jest.useRealTimers();
});

function timeoutLog(): unknown {
  return consoleError.mock.calls.find(
    ([message]) => message === "[useAppBootstrap] initialization exceeded safety timeout",
  )?.[1];
}

describe("useAppBootstrap", () => {
  it("resolves the destination once fonts, Clerk and storage are ready", async () => {
    const { result } = renderHook(() => useAppBootstrap());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });

    expect(result.current).toMatchObject({ status: "ready", destination: "home", error: null });
    expect(timeoutLog()).toBeUndefined();
  });

  it("names Clerk and its status when Clerk never finishes loading", async () => {
    mockAuth = { isLoaded: false, isSignedIn: undefined };
    mockClerkStatus = "loading";
    const { result } = renderHook(() => useAppBootstrap());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });

    expect(result.current.status).toBe("error");
    expect(timeoutLog()).toEqual({ pending: ["clerk"], clerkStatus: "loading", attempt: 0 });
  });

  it("names fonts when they never load", async () => {
    mockFontsLoaded = false;
    renderHook(() => useAppBootstrap());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });

    expect(timeoutLog()).toEqual({ pending: ["fonts"], clerkStatus: "ready", attempt: 0 });
  });

  it("names onboarding storage when the SecureStore read hangs", async () => {
    mockGetOnboardingCompleted.mockReturnValue(new Promise(() => {}));
    renderHook(() => useAppBootstrap());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });

    expect(timeoutLog()).toEqual({
      pending: ["onboarding-storage"],
      clerkStatus: "ready",
      attempt: 0,
    });
  });

  it("logs a Clerk load failure as soon as Clerk reports it", () => {
    mockAuth = { isLoaded: false, isSignedIn: undefined };
    mockClerkStatus = "error";
    renderHook(() => useAppBootstrap());

    expect(consoleError).toHaveBeenCalledWith(
      "[useAppBootstrap] Clerk failed to load (status: error)",
    );
  });

  it("recovers by itself if Clerk loads after the timeout", async () => {
    mockAuth = { isLoaded: false, isSignedIn: undefined };
    const { result, rerender } = renderHook(() => useAppBootstrap());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });
    expect(result.current.status).toBe("error");

    mockAuth = { isLoaded: true, isSignedIn: false };
    rerender({});
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toMatchObject({ status: "ready", destination: "auth" });
  });

  it("never swaps a ready navigator for the error screen on a later sign-out", async () => {
    const { result, rerender } = renderHook(() => useAppBootstrap());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS);
    });
    expect(result.current).toMatchObject({ status: "ready", destination: "home" });

    // Signing out re-evaluates the destination; a stalled storage read then
    // must not unmount the Stack mid-transition.
    mockGetOnboardingCompleted.mockReturnValue(new Promise(() => {}));
    mockAuth = { isLoaded: true, isSignedIn: false };
    rerender({});
    await act(async () => {
      await jest.advanceTimersByTimeAsync(SAFETY_TIMEOUT_MS * 2);
    });

    expect(result.current).toMatchObject({ status: "ready", destination: "home", error: null });
    expect(timeoutLog()).toBeUndefined();
  });
});
