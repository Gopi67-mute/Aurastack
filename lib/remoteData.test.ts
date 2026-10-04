import { shouldLoad } from "./remoteData";

describe("shouldLoad", () => {
  it("loads automatically only from idle", () => {
    expect(shouldLoad("idle")).toBe(true);
    expect(shouldLoad("loading")).toBe(false);
    expect(shouldLoad("ready")).toBe(false);
    expect(shouldLoad("error")).toBe(false);
  });

  it("lets an explicit refresh reload a ready or failed store", () => {
    expect(shouldLoad("ready", true)).toBe(true);
    expect(shouldLoad("error", true)).toBe(true);
    expect(shouldLoad("idle", true)).toBe(true);
  });

  it("never starts a second request while one is in flight", () => {
    expect(shouldLoad("loading", true)).toBe(false);
  });
});
