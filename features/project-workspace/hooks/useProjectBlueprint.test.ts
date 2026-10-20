import { act, renderHook } from "@testing-library/react-native";

import { ApiError } from "../../../lib/api";
import { blueprintContent } from "../__fixtures__/blueprint";
import { generateProjectBlueprint } from "../services/generateProjectBlueprint";
import { getProjectBlueprint } from "../services/getProjectBlueprint";
import type {
  ProjectBlueprintContent,
  ProjectBlueprintResponse,
  ProjectBlueprintStatus,
} from "../types/blueprint";
import { useProjectBlueprint } from "./useProjectBlueprint";

// Mirrors @clerk/expo, whose useAuth returns a new getToken on every render.
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));
jest.mock("../services/getProjectBlueprint", () => ({ getProjectBlueprint: jest.fn() }));
jest.mock("../services/generateProjectBlueprint", () => ({ generateProjectBlueprint: jest.fn() }));

const mockGet = jest.mocked(getProjectBlueprint);
const mockPost = jest.mocked(generateProjectBlueprint);

const POLL_MS = 3_000;
const MAX_POLL_MS = 150_000;

function content(summary: string): ProjectBlueprintContent {
  return blueprintContent({ summary });
}

const READY_A = content("Blueprint A");
const READY_B = content("Blueprint B");

function reply(status: ProjectBlueprintStatus, blueprint: ProjectBlueprintContent = READY_A): ProjectBlueprintResponse {
  return status === "ready"
    ? { status, blueprint, generatedAt: "2026-10-06T00:00:00.000Z" }
    : { status, blueprint: null, generatedAt: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Advances fake time, letting every request that settles meanwhile run its follow-ups. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const flush = () => advance(0);

interface Props {
  projectId: string | undefined;
  enabled: boolean;
}

function renderBlueprint(initial: Props = { projectId: "p1", enabled: true }) {
  return renderHook(({ projectId, enabled }: Props) => useProjectBlueprint(projectId, enabled), {
    initialProps: initial,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockGet.mockReset();
  mockPost.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useProjectBlueprint initial load", () => {
  it("reads the blueprint when enabled", async () => {
    mockGet.mockResolvedValue(reply("ready"));
    const { result } = renderBlueprint();

    expect(result.current.status).toBe("loading");
    await flush();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0][0]).toBe("p1");
    await expect(mockGet.mock.calls[0][1]()).resolves.toBe("test-token");
  });

  it("makes no request while disabled", async () => {
    const { result } = renderBlueprint({ projectId: "p1", enabled: false });
    await advance(10_000);

    expect(result.current.status).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("makes no request without a project id", async () => {
    const { result } = renderBlueprint({ projectId: undefined, enabled: true });
    await flush();

    expect(result.current.status).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("shows a ready blueprint immediately and never generates or polls", async () => {
    mockGet.mockResolvedValue(reply("ready"));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.status).toBe("ready");
    expect(result.current.blueprint).toEqual(READY_A);
    await advance(30_000);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("does not re-read on re-renders", async () => {
    mockGet.mockResolvedValue(reply("ready"));
    const { rerender } = renderBlueprint();
    await flush();

    rerender({ projectId: "p1", enabled: true });
    rerender({ projectId: "p1", enabled: true });
    await flush();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe("useProjectBlueprint missing blueprint", () => {
  it("requests generation exactly once, after reading", async () => {
    mockGet.mockResolvedValueOnce(reply("missing")).mockResolvedValue(reply("generating"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    expect(mockGet.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[0]);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe("p1");
    expect(result.current.status).toBe("generating");
  });

  it("never requests again when reads keep reporting missing", async () => {
    mockGet.mockResolvedValue(reply("missing"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();
    await advance(POLL_MS);

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/Couldn't start generating/);

    act(() => result.current.refresh());
    await advance(30_000);

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("cannot request twice when its effect runs, cleans up and runs again", async () => {
    // What Strict Mode does on mount. Simulated: react-test-renderer only
    // replays effects under its own strict flag, which RNTL does not set.
    const first = deferred<ProjectBlueprintResponse>();
    mockGet.mockReturnValueOnce(first.promise).mockResolvedValueOnce(reply("missing")).mockResolvedValue(reply("generating"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result, rerender } = renderBlueprint();
    rerender({ projectId: "p1", enabled: false });
    rerender({ projectId: "p1", enabled: true });
    await flush();

    first.resolve(reply("missing"));
    await flush();

    // Both runs read and saw "missing"; only the current one may act on it.
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("generating");
  });

  it("cannot request twice when the same project's reads overlap", async () => {
    // Two quick Try Again taps: each starts a read before the other settles.
    const first = deferred<ProjectBlueprintResponse>();
    mockGet.mockResolvedValueOnce(reply("failed")).mockReturnValueOnce(first.promise).mockResolvedValueOnce(reply("failed")).mockResolvedValue(reply("generating"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    act(() => {
      result.current.retry();
      result.current.retry();
    });
    await flush();
    first.resolve(reply("failed"));
    await flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("generating");
  });
});

describe("useProjectBlueprint polling", () => {
  it("re-reads every 3 seconds while generating", async () => {
    mockGet.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();
    expect(result.current.status).toBe("generating");
    expect(mockGet).toHaveBeenCalledTimes(1);

    await advance(POLL_MS - 1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
    await advance(POLL_MS);
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("stops once the blueprint is ready", async () => {
    mockGet
      .mockResolvedValueOnce(reply("generating"))
      .mockResolvedValueOnce(reply("generating"))
      .mockResolvedValue(reply("ready"));
    const { result } = renderBlueprint();
    await flush();
    await advance(2 * POLL_MS);

    expect(result.current.status).toBe("ready");
    expect(result.current.blueprint).toEqual(READY_A);
    await advance(30_000);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("stops once the blueprint has failed, without retrying", async () => {
    mockGet.mockResolvedValueOnce(reply("generating")).mockResolvedValue(reply("failed"));
    const { result } = renderBlueprint();
    await flush();
    await advance(POLL_MS);

    expect(result.current.status).toBe("failed");
    await advance(30_000);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("gives up at the 150 second deadline and only re-reads on refresh", async () => {
    mockGet.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    await advance(MAX_POLL_MS - POLL_MS);
    expect(result.current.status).toBe("generating");
    await advance(POLL_MS);
    expect(result.current.status).toBe("timedOut");
    const reads = mockGet.mock.calls.length;
    expect(reads).toBe(MAX_POLL_MS / POLL_MS + 1);

    await advance(60_000);
    expect(mockGet).toHaveBeenCalledTimes(reads);

    act(() => result.current.refresh());
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(reads + 1);
    expect(result.current.status).toBe("generating");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("keeps polling through a failed read while generating", async () => {
    mockGet
      .mockResolvedValueOnce(reply("generating"))
      .mockRejectedValueOnce(new ApiError("offline", 0))
      .mockResolvedValue(reply("ready"));
    const { result } = renderBlueprint();
    await flush();
    await advance(POLL_MS);
    expect(result.current.status).toBe("generating");

    await advance(POLL_MS);
    expect(result.current.status).toBe("ready");
  });
});

describe("useProjectBlueprint failed blueprint", () => {
  it("does not retry on its own, and Try Again generates exactly once", async () => {
    mockGet
      .mockResolvedValueOnce(reply("failed"))
      .mockResolvedValueOnce(reply("failed"))
      .mockResolvedValue(reply("generating"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.status).toBe("failed");
    await advance(30_000);
    expect(mockPost).not.toHaveBeenCalled();

    act(() => result.current.retry());
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("generating");

    await advance(POLL_MS);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("shows the failure again, without another request, when the retried generation fails", async () => {
    mockGet
      .mockResolvedValueOnce(reply("failed"))
      .mockResolvedValueOnce(reply("failed"))
      .mockResolvedValue(reply("failed"));
    mockPost.mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    act(() => result.current.retry());
    await flush();
    await advance(POLL_MS);

    expect(result.current.status).toBe("failed");
    await advance(30_000);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe("useProjectBlueprint 409 conflict", () => {
  it("re-reads instead of failing, and follows the generation already running", async () => {
    mockGet.mockResolvedValueOnce(reply("missing")).mockResolvedValue(reply("generating"));
    mockPost.mockRejectedValue(new ApiError("Blueprint generation is already in progress", 409));
    const { result } = renderBlueprint();
    await flush();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("generating");
    await advance(POLL_MS);
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("shows a blueprint generated elsewhere", async () => {
    mockGet.mockResolvedValueOnce(reply("missing")).mockResolvedValue(reply("ready"));
    mockPost.mockRejectedValue(new ApiError("Blueprint has already been generated", 409));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.status).toBe("ready");
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the re-read still reports missing", async () => {
    mockGet.mockResolvedValue(reply("missing"));
    mockPost.mockRejectedValue(new ApiError("Project curriculum is not ready yet", 409));
    const { result } = renderBlueprint();
    await flush();
    await advance(30_000);

    expect(result.current.status).toBe("error");
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe("useProjectBlueprint errors", () => {
  it("surfaces a failed read and recovers on retry", async () => {
    mockGet.mockRejectedValueOnce(new ApiError("Couldn't reach the server.", 0)).mockResolvedValue(reply("ready"));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Couldn't reach the server.");
    await advance(30_000);
    expect(mockGet).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    await flush();
    expect(result.current.status).toBe("ready");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("uses a generic message for unexpected errors", async () => {
    mockGet.mockRejectedValue(new Error("boom"));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.error).toBe("Couldn't load your blueprint.");
  });

  it("keeps ready content when a later read fails", async () => {
    mockGet.mockResolvedValueOnce(reply("ready")).mockRejectedValue(new ApiError("offline", 0));
    const { result, rerender } = renderBlueprint();
    await flush();

    // Leaving for Learning and coming back re-reads the blueprint.
    rerender({ projectId: "p1", enabled: false });
    rerender({ projectId: "p1", enabled: true });
    expect(result.current.status).toBe("ready");
    await flush();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
    expect(result.current.blueprint).toEqual(READY_A);
  });

  it("surfaces a failed generation request, and Try Again requests once more", async () => {
    mockGet.mockResolvedValueOnce(reply("missing")).mockResolvedValueOnce(reply("missing")).mockResolvedValue(reply("generating"));
    mockPost.mockRejectedValueOnce(new ApiError("Couldn't reach the server.", 0)).mockResolvedValue(reply("generating"));
    const { result } = renderBlueprint();
    await flush();

    expect(result.current.status).toBe("error");
    await advance(30_000);
    expect(mockPost).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("generating");
  });
});

describe("useProjectBlueprint lifecycle", () => {
  it("ignores a read that settles after unmount", async () => {
    const pending = deferred<ProjectBlueprintResponse>();
    mockGet.mockReturnValue(pending.promise);
    const { unmount } = renderBlueprint();
    unmount();

    pending.resolve(reply("missing"));
    await advance(30_000);

    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("ignores a generation response that settles after unmount", async () => {
    const pending = deferred<ProjectBlueprintResponse>();
    mockGet.mockResolvedValue(reply("missing"));
    mockPost.mockReturnValue(pending.promise);
    const { unmount } = renderBlueprint();
    await flush();
    unmount();

    pending.resolve(reply("generating"));
    await advance(30_000);

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("stops polling on unmount", async () => {
    mockGet.mockResolvedValue(reply("generating"));
    const { unmount } = renderBlueprint();
    await flush();
    unmount();

    await advance(30_000);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("never lets the previous project's response update the new one", async () => {
    const pendingA = deferred<ProjectBlueprintResponse>();
    mockGet.mockImplementation((projectId) =>
      projectId === "a" ? pendingA.promise : Promise.resolve(reply("ready", READY_B)),
    );
    const { result, rerender } = renderBlueprint({ projectId: "a", enabled: true });

    rerender({ projectId: "b", enabled: true });
    await flush();
    expect(result.current.blueprint).toEqual(READY_B);

    pendingA.resolve(reply("missing"));
    await advance(30_000);

    expect(result.current.status).toBe("ready");
    expect(result.current.blueprint).toEqual(READY_B);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("does not show the previous project's blueprint while the next one loads", async () => {
    const pendingB = deferred<ProjectBlueprintResponse>();
    mockGet.mockImplementation((projectId) =>
      projectId === "a" ? Promise.resolve(reply("ready", READY_A)) : pendingB.promise,
    );
    const { result, rerender } = renderBlueprint({ projectId: "a", enabled: true });
    await flush();

    rerender({ projectId: "b", enabled: true });
    expect(result.current.status).toBe("loading");
    expect(result.current.blueprint).toBeNull();
  });

  it("ignores a read that settles after being disabled, and never generates for it", async () => {
    const pending = deferred<ProjectBlueprintResponse>();
    mockGet.mockReturnValueOnce(pending.promise).mockResolvedValue(reply("generating"));
    const { result, rerender } = renderBlueprint();

    rerender({ projectId: "p1", enabled: false });
    pending.resolve(reply("missing"));
    await advance(30_000);

    expect(result.current.status).toBe("idle");
    expect(mockPost).not.toHaveBeenCalled();

    rerender({ projectId: "p1", enabled: true });
    expect(result.current.status).toBe("loading");
    await flush();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("generating");
  });

  it("stops polling while disabled", async () => {
    mockGet.mockResolvedValue(reply("generating"));
    const { rerender } = renderBlueprint();
    await flush();

    rerender({ projectId: "p1", enabled: false });
    await advance(30_000);

    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
