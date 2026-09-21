import { BookOpen, Layers, Network, Route } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import type { WorkspaceSectionKey } from "../types/workspace";

export interface WorkspaceSectionConfig {
  key: WorkspaceSectionKey;
  label: string;
  Icon: LucideIcon;
  /** Shown while the project has no generated data for this section. */
  preparingHint: string;
}

/** Display order of the workspace's internal sections. */
export const WORKSPACE_SECTIONS: readonly WorkspaceSectionConfig[] = [
  {
    key: "techStack",
    label: "Tech Stack",
    Icon: Layers,
    preparingHint:
      "Your recommended technologies will appear here once your project blueprint is generated.",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    Icon: Route,
    preparingHint:
      "Your development roadmap will appear here once your project blueprint is generated.",
  },
  {
    key: "architecture",
    label: "Architecture",
    Icon: Network,
    preparingHint:
      "Your project architecture will appear here once your blueprint is generated.",
  },
  {
    key: "learning",
    label: "Learning",
    Icon: BookOpen,
    preparingHint:
      "Your required learning path will appear here once your project blueprint is generated.",
  },
];

export const DEFAULT_WORKSPACE_SECTION: WorkspaceSectionKey = "techStack";
