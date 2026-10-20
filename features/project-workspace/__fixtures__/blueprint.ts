/** Test-only blueprint data shaped exactly like the backend's 2.0 client contract. */

import type {
  BlueprintArchitecture,
  BlueprintRoadmapPhase,
  BlueprintTechChoice,
  ProjectBlueprintContent,
} from "../types/blueprint";

export function techChoice(overrides: Partial<BlueprintTechChoice> = {}): BlueprintTechChoice {
  return {
    category: "frontend",
    name: "React Native",
    purpose: "Mobile UI",
    rationale: "One codebase for Android and iOS.",
    alternatives: [],
    integrationNotes: null,
    ...overrides,
  };
}

export function roadmapPhase(overrides: Partial<BlueprintRoadmapPhase> = {}): BlueprintRoadmapPhase {
  return {
    order: 1,
    title: "Foundation",
    goal: "Set up the stack",
    rationale: "Everything else builds on it.",
    tasks: ["Create the repo", "Add CI"],
    deliverables: ["A running skeleton"],
    acceptanceCriteria: ["The app reaches the API"],
    dependsOn: [],
    techCategories: [],
    risks: [],
    learning: [],
    ...overrides,
  };
}

export function architecture(overrides: Partial<BlueprintArchitecture> = {}): BlueprintArchitecture {
  return {
    style: "Layered",
    overview: "Client, API and database.",
    components: [],
    flows: [],
    failureModes: [],
    tradeoffs: [],
    ...overrides,
  };
}

export function blueprintContent(overrides: Partial<ProjectBlueprintContent> = {}): ProjectBlueprintContent {
  return {
    summary: "A storefront app.",
    assumptions: [],
    techStack: [techChoice()],
    architecture: architecture(),
    roadmap: [roadmapPhase()],
    ...overrides,
  };
}
