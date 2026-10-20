import { render, screen } from "@testing-library/react-native";

import type { ProjectStatus } from "../../projects/types/projects";
import type { ProjectLearning } from "../types/learning";
import { summarizeTopics } from "../utils/summarizeTopics";
import { ProjectLearningCard } from "./ProjectLearningCard";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const EMPTY: ProjectLearning = {
  projectId: "p1",
  projectName: "Storefront",
  createdAt: "2026-10-01T00:00:00.000Z",
  topics: [],
};

function renderCard(generationStatus: ProjectStatus | undefined) {
  render(
    <ProjectLearningCard
      project={EMPTY}
      summary={summarizeTopics(EMPTY.topics)}
      generationStatus={generationStatus}
      onPress={() => {}}
    />,
  );
}

describe("ProjectLearningCard without topics", () => {
  it.each([
    ["generating", "Generating your learning plan…"],
    ["failed", "We couldn't generate this learning plan."],
    ["ready", "Learning plan unavailable. Open it to reload."],
    [undefined, "Loading learning plan…"],
  ] as const)("describes a %s project from its server status", (status, label) => {
    renderCard(status);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByLabelText(`Storefront, ${label}`)).toBeTruthy();
  });
});
