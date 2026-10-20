import { getMomentum } from "../features/progress/services/getMomentum";
import type { MomentumState } from "../features/progress/types/progress";
import { useMomentumStore } from "./useMomentumStore";

jest.mock("../features/progress/services/getMomentum", () => ({ getMomentum: jest.fn() }));

const mockGetMomentum = jest.mocked(getMomentum);
const getToken = () => Promise.resolve("test-token");

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function momentum(topics: number): MomentumState {
  return {
    streakDays: 1,
    isActiveToday: true,
    lastActivityDay: "2026-10-06",
    totalActiveDays: 1,
    timezone: "UTC",
    week: [],
    weekly: { tasks: 0, topics, milestones: 0 },
    recentActivity: [],
  };
}

const topicsThisWeek = () => useMomentumStore.getState().momentum?.weekly.topics;

beforeEach(() => {
  mockGetMomentum.mockReset();
  useMomentumStore.getState().reset();
});

describe("useMomentumStore load coalescing", () => {
  it("runs exactly one fresh load after the in-flight one when forced meanwhile", async () => {
    const first = deferred<MomentumState>();
    const second = deferred<MomentumState>();
    const secondRequested = deferred<void>();
    mockGetMomentum.mockReturnValueOnce(first.promise).mockImplementationOnce(() => {
      secondRequested.resolve();
      return second.promise;
    });

    const initial = useMomentumStore.getState().load(getToken);
    // Two topics completed while the first read was in flight.
    const forced = useMomentumStore.getState().load(getToken, true);
    const forcedAgain = useMomentumStore.getState().load(getToken, true);
    let forcedSettled = false;
    void forced.then(() => {
      forcedSettled = true;
    });
    expect(mockGetMomentum).toHaveBeenCalledTimes(1);

    // The first read predates those completions.
    first.resolve(momentum(1));
    await secondRequested.promise;
    expect(mockGetMomentum).toHaveBeenCalledTimes(2);
    expect(forcedSettled).toBe(false);

    second.resolve(momentum(3));
    await Promise.all([initial, forced, forcedAgain]);

    expect(topicsThisWeek()).toBe(3);
    expect(useMomentumStore.getState().status).toBe("ready");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockGetMomentum).toHaveBeenCalledTimes(2);
  });

  it("does not reload when only unforced loads arrive meanwhile", async () => {
    const first = deferred<MomentumState>();
    mockGetMomentum.mockReturnValueOnce(first.promise).mockResolvedValue(momentum(2));

    const initial = useMomentumStore.getState().load(getToken);
    const unforced = useMomentumStore.getState().load(getToken);
    first.resolve(momentum(1));
    await Promise.all([initial, unforced]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockGetMomentum).toHaveBeenCalledTimes(1);
    expect(topicsThisWeek()).toBe(1);
  });

  it("drops the pending reload when reset meanwhile", async () => {
    const first = deferred<MomentumState>();
    mockGetMomentum.mockReturnValueOnce(first.promise).mockResolvedValue(momentum(2));

    const initial = useMomentumStore.getState().load(getToken);
    const forced = useMomentumStore.getState().load(getToken, true);
    useMomentumStore.getState().reset();
    first.resolve(momentum(1));
    await Promise.all([initial, forced]);

    expect(mockGetMomentum).toHaveBeenCalledTimes(1);
    expect(useMomentumStore.getState().momentum).toBeNull();
    expect(useMomentumStore.getState().status).toBe("idle");
  });

  it("starts a new load once the previous one has settled", async () => {
    mockGetMomentum.mockResolvedValue(momentum(1));

    await useMomentumStore.getState().load(getToken);
    await useMomentumStore.getState().load(getToken, true);

    expect(mockGetMomentum).toHaveBeenCalledTimes(2);
  });
});
