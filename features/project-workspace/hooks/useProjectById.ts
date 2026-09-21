import { useEffect, useState } from "react";

import { useProjectStore } from "../../../store/useProjectStore";
import type { Project } from "../../projects/types/projects";

interface UseProjectByIdResult {
  project: Project | undefined;
  /** False until the persisted project list has been read from AsyncStorage. */
  isHydrated: boolean;
}

/**
 * Looks up a project in the shared store. `isHydrated` lets callers avoid
 * showing "not found" before persistence has restored the list (cold start
 * or deep link straight into a workspace).
 */
export function useProjectById(projectId: string | undefined): UseProjectByIdResult {
  const project = useProjectStore((state) =>
    projectId === undefined
      ? undefined
      : state.projects.find((candidate) => candidate.id === projectId),
  );
  const [isHydrated, setIsHydrated] = useState(() => useProjectStore.persist.hasHydrated());

  useEffect(() => {
    const unsubscribe = useProjectStore.persist.onFinishHydration(() => setIsHydrated(true));
    // Hydration may have finished between the initial render and subscribing.
    setIsHydrated(useProjectStore.persist.hasHydrated());
    return unsubscribe;
  }, []);

  return { project, isHydrated };
}
