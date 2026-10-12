import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import { architecture, blueprintContent, roadmapPhase } from "../__fixtures__/blueprint";
import { BlueprintState } from "./BlueprintState";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const BLUEPRINT = blueprintContent({
  architecture: architecture({
    components: [{ key: "api", name: "API Server", kind: "service", responsibility: "Logic", connections: [] }],
  }),
  roadmap: [roadmapPhase({ deliverables: ["Repo"] })],
});

const onRetry = jest.fn();
const onRefresh = jest.fn();

function renderState(props: Partial<ComponentProps<typeof BlueprintState>>) {
  return render(
    <BlueprintState
      section="techStack"
      status="loading"
      blueprint={null}
      error={null}
      onRetry={onRetry}
      onRefresh={onRefresh}
      {...props}
    />,
  );
}

beforeEach(() => {
  onRetry.mockClear();
  onRefresh.mockClear();
});

describe("BlueprintState", () => {
  it("shows loading", () => {
    renderState({ status: "loading" });

    expect(screen.getByLabelText("Loading blueprint")).toBeTruthy();
  });

  it("shows generating", () => {
    renderState({ status: "generating" });

    expect(screen.getByText("Designing your blueprint…")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows a failure with Try Again, which retries exactly once per press", () => {
    renderState({ status: "failed" });

    expect(screen.getByText("Couldn't generate your blueprint")).toBeTruthy();
    expect(screen.getByText("Try Again")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Try generating the blueprint again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("shows the timed-out state with Refresh, which only re-reads", () => {
    renderState({ status: "timedOut" });

    expect(screen.getByText("Blueprint generation is taking longer than expected.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Refresh the blueprint" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("shows an error with its message and a retry", () => {
    renderState({ status: "error", error: "Couldn't reach the server." });

    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic error message", () => {
    renderState({ status: "error", error: null });

    expect(screen.getByText("Couldn't load your blueprint.")).toBeTruthy();
  });

  it.each([
    ["techStack", "React Native"],
    ["architecture", "API Server"],
    ["roadmap", "Foundation"],
  ] as const)("renders the ready %s section", (section, text) => {
    renderState({ status: "ready", blueprint: BLUEPRINT, section });

    expect(screen.getByText(text)).toBeTruthy();
  });

  it.each([
    ["techStack", "bg-section-tech/10"],
    ["roadmap", "bg-section-roadmap/10"],
    ["architecture", "bg-section-architecture/10"],
  ] as const)("tints the %s generating notice with that section's accent", (section, tint) => {
    renderState({ status: "generating", section });

    const markup = JSON.stringify(screen.toJSON());
    expect(markup).toContain(tint);
    expect(markup).not.toContain("bg-aura-purple/15");
  });

  it("keeps the semantic error color for a failure in any section", () => {
    renderState({ status: "failed", section: "roadmap" });

    const markup = JSON.stringify(screen.toJSON());
    expect(markup).toContain("bg-error/15");
    expect(markup).not.toContain("bg-section-roadmap/10");
  });

  it("renders only the requested section", () => {
    renderState({ status: "ready", blueprint: BLUEPRINT, section: "roadmap" });

    expect(screen.queryByText("React Native")).toBeNull();
    expect(screen.queryByText("API Server")).toBeNull();
  });
});
