import type { ProjectPlatform } from "../../create-project/types/createProject";

export type ProjectIconKey = "commerce" | "chat" | "web";

/**
 * Server-owned generation lifecycle; the client only ever reads it.
 * "generating": created, curriculum still being generated.
 * "ready": generated; its learning curriculum exists.
 * "failed": generation failed or stalled; can be retried.
 */
export type ProjectStatus = "generating" | "ready" | "failed";

/** Client-side project summary; the Projects API will return this shape. */
export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  /**
   * Learning progress, 0-100: completed / total topics of the active
   * curriculum. Calculated by the server on every read and never written by
   * the client; 0 while generating or failed.
   */
  progress: number;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** User-provided idea. Absent on legacy mock projects. */
  description?: string;
  platforms?: readonly ProjectPlatform[];
  /** Absent until a generated blueprint exists. */
  techStack?: readonly string[];
  /** Null until a generated icon exists. */
  iconKey?: ProjectIconKey | null;
}
