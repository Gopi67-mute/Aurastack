import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useProjectStore } from "../../../store/useProjectStore";
import { getProjects } from "../services/getProjects";
import type { Project } from "../types/projects";
import { useProjects } from "./useProjects";

// Mirrors @clerk/expo, whose useAuth returns a new getToken on every render.
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ getToken: () => Promise.resolve("test-token") }),
}));

jest.mock("../services/getProjects", () => ({ getProjects: jest.fn() }));

const mockGetProjects = jest.mocked(getProjects);

const PROJECT: Project = {
  id: "project-1",
  name: "Storefront",
  status: "preparing",
  progress: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
};

/** Lets pending requests settle, along with any re-renders and effects they cause. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  mockGetProjects.mockReset();
  useProjectStore.setState({ projects: [], status: "idle", error: null });
});

describe("useProjects", () => {
  it("loads once on mount and does not refetch once ready", async () => {
    mockGetProjects.mockResolvedValue([PROJECT]);

    const { result, rerender } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.projects).toEqual([PROJECT]);
    expect(result.current.error).toBeNull();
    await expect(mockGetProjects.mock.calls[0][0]()).resolves.toBe("test-token");

    rerender({});
    rerender({});
    await settle();
    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });

  it("reaches the error state and does not retry on its own", async () => {
    mockGetProjects.mockRejectedValue(new Error("offline"));

    const { result, rerender } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Couldn't load your projects.");

    // Each render hands useAuth a fresh getToken; none may restart the load.
    rerender({});
    rerender({});
    await settle();

    expect(result.current.status).toBe("error");
    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed load when another screen mounts", async () => {
    mockGetProjects.mockRejectedValue(new Error("offline"));

    const first = renderHook(() => useProjects());
    await waitFor(() => expect(first.result.current.status).toBe("error"));

    const second = renderHook(() => useProjects());
    await settle();

    expect(second.result.current.status).toBe("error");
    expect(mockGetProjects).toHaveBeenCalledTimes(1);
  });

  it("retries when the user explicitly refreshes after a failure", async () => {
    mockGetProjects.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([PROJECT]);

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.status).toBe("error"));

    await act(() => result.current.refresh());

    expect(mockGetProjects).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
    expect(result.current.projects).toEqual([PROJECT]);
    expect(result.current.error).toBeNull();
  });

  it("keeps the loaded projects when a refresh fails", async () => {
    mockGetProjects.mockResolvedValueOnce([PROJECT]).mockRejectedValueOnce(new Error("offline"));

    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(() => result.current.refresh());
    await settle();

    expect(result.current.status).toBe("error");
    expect(result.current.projects).toEqual([PROJECT]);
    expect(mockGetProjects).toHaveBeenCalledTimes(2);
  });

  it("keeps refresh stable across renders", async () => {
    mockGetProjects.mockResolvedValue([PROJECT]);

    const { result, rerender } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const { refresh } = result.current;

    rerender({});

    expect(result.current.refresh).toBe(refresh);
  });
});
