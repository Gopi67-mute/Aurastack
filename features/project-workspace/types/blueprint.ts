import type { WorkspaceSectionKey } from "./workspace";

/**
 * Server-derived on every read; the client never computes it.
 * "missing": nothing generated for the project's current curriculum yet.
 * "generating": a generation is running.
 * "ready": `blueprint` is set.
 * "failed": the last generation failed or stalled; can be retried.
 */
export type ProjectBlueprintStatus = "missing" | "generating" | "ready" | "failed";

export type BlueprintTechCategory =
  | "frontend"
  | "backend"
  | "database"
  | "authentication"
  | "ai"
  | "storage"
  | "realtime"
  | "infrastructure"
  | "testing"
  | "other";

export type BlueprintComponentKind = "client" | "service" | "datastore" | "external";

export interface BlueprintTechAlternative {
  name: string;
  /** When to choose it instead, and what is given up. */
  tradeoff: string;
}

export interface BlueprintTechChoice {
  category: BlueprintTechCategory;
  name: string;
  /** Its role in this project. */
  purpose: string;
  /** Why it fits this project's requirements. */
  rationale: string;
  /** Empty for a technology the user chose themselves. */
  alternatives: readonly BlueprintTechAlternative[];
  integrationNotes: string | null;
}

export interface BlueprintComponentConnection {
  /** Key of the component this one calls or reads from. */
  target: string;
  interaction: string;
}

export interface BlueprintArchitectureComponent {
  /** Identifies the component within this blueprint; referenced by connections and flows. */
  key: string;
  name: string;
  kind: BlueprintComponentKind;
  responsibility: string;
  connections: readonly BlueprintComponentConnection[];
}

export interface BlueprintFlowStep {
  /** Component keys; equal when a component acts on its own. */
  actor: string;
  target: string;
  action: string;
}

/** One important user journey through the components, in order. */
export interface BlueprintFlow {
  name: string;
  steps: readonly BlueprintFlowStep[];
}

export interface BlueprintFailureMode {
  scenario: string;
  handling: string;
}

export interface BlueprintArchitecture {
  style: string;
  overview: string;
  components: readonly BlueprintArchitectureComponent[];
  flows: readonly BlueprintFlow[];
  failureModes: readonly BlueprintFailureMode[];
  tradeoffs: readonly string[];
}

/** A curriculum topic applied in a roadmap phase. */
export interface BlueprintPhaseLearning {
  topicOrder: number;
  /** The topic's title in the curriculum the blueprint was built from. */
  topicTitle: string;
  /** What the developer builds with it in this phase. */
  application: string;
}

export interface BlueprintRoadmapPhase {
  order: number;
  title: string;
  goal: string;
  /** Why this phase matters at this point. */
  rationale: string;
  tasks: readonly string[];
  deliverables: readonly string[];
  /** Observable checks that the phase is done. */
  acceptanceCriteria: readonly string[];
  /** Orders of the earlier phases this one builds on. */
  dependsOn: readonly number[];
  techCategories: readonly BlueprintTechCategory[];
  risks: readonly string[];
  learning: readonly BlueprintPhaseLearning[];
}

/**
 * The AI-generated technical blueprint. Its `techStack` is a recommendation,
 * distinct from the user-entered `Project.techStack`.
 */
export interface ProjectBlueprintContent {
  summary: string;
  /** What the blueprint relies on that the user did not state. */
  assumptions: readonly string[];
  techStack: readonly BlueprintTechChoice[];
  architecture: BlueprintArchitecture;
  roadmap: readonly BlueprintRoadmapPhase[];
}

/** GET /projects/{id}/blueprint and POST .../blueprint/generation. */
export interface ProjectBlueprintResponse {
  status: ProjectBlueprintStatus;
  /** Set only while `status` is "ready". */
  blueprint: ProjectBlueprintContent | null;
  /** ISO 8601; set only while `status` is "ready". */
  generatedAt: string | null;
}

/** Workspace sections rendered from the blueprint. */
export type BlueprintSectionKey = Exclude<WorkspaceSectionKey, "learning">;

/**
 * What the workspace shows for a blueprint, as followed by useProjectBlueprint.
 * "idle": not being followed (another section is open, or the project is not ready).
 * "timedOut": still generating when the client stopped polling.
 * "error": a request failed, or a generation could not be started.
 */
export type BlueprintLoadStatus =
  | "idle"
  | "loading"
  | "generating"
  | "ready"
  | "failed"
  | "timedOut"
  | "error";
