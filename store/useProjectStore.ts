import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createMockProjects } from "../features/projects/constants/mockProjects";
import type { Project } from "../features/projects/types/projects";

/** Follows the `auraStack.<domain>.<key>` convention of onboardingStorage. */
const PROJECTS_STORAGE_KEY = "auraStack.projects";

/** Bump when the persisted `Project` shape changes and add a `migrate`. */
const PROJECTS_STORAGE_VERSION = 1;

interface ProjectStoreState {
  projects: readonly Project[];
  addProject: (project: Project) => void;
}

/**
 * Client-side project list shared by Home, Projects and Create Project.
 * Persisted to AsyncStorage so projects survive reloads and restarts.
 *
 * The mock projects are only the initial state: on first launch nothing is
 * persisted so they are used (and saved on the first change); once a
 * persisted collection exists, it replaces them on rehydration, so mocks
 * never overwrite user-created projects. The server (FastAPI → MongoDB)
 * becomes the source of truth later.
 */
export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set) => ({
      projects: createMockProjects(),
      addProject: (project) =>
        set((state) => ({ projects: [project, ...state.projects] })),
    }),
    {
      name: PROJECTS_STORAGE_KEY,
      version: PROJECTS_STORAGE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ projects: state.projects }),
    },
  ),
);
