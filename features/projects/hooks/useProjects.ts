import { useMemo } from "react";

import { useProjectStore } from "../../../store/useProjectStore";
import type { Project } from "../types/projects";

function byNewestFirst(a: Project, b: Project): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/** Returns the user's projects from the shared store, most recently created first. */
export function useProjects(): { projects: readonly Project[] } {
  const stored = useProjectStore((state) => state.projects);
  const projects = useMemo(() => [...stored].sort(byNewestFirst), [stored]);
  return { projects };
}
