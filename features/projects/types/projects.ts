import type { ProjectPlatform } from "../../create-project/types/createProject";

export type ProjectIconKey = "commerce" | "chat" | "web";

/**
 * "preparing": created by the user, not yet AI-generated (no stack/roadmap).
 * "ready": has a generated blueprint (all current mock projects).
 */
export type ProjectStatus = "preparing" | "ready";

/** Client-side project summary; the Projects API will return this shape. */
export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  /** Completion percentage, 0-100. */
  progress: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** User-provided idea. Absent on legacy mock projects. */
  description?: string;
  platforms?: readonly ProjectPlatform[];
  /** Absent until a generated blueprint exists. */
  techStack?: readonly string[];
  iconKey?: ProjectIconKey;
}
