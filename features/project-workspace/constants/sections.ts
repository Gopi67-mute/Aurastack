import { BookOpen, Layers, Network, Route } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors } from "../../../theme/colors";
import type { WorkspaceSectionKey } from "../types/workspace";

/**
 * A section's accent, as NativeWind classes plus the raw color for props
 * such as an icon's `color`. Class names are complete literals so Tailwind
 * can find them; never build them from parts.
 */
export interface SectionAccent {
  color: string;
  /** Accent text. */
  text: string;
  /** Solid accent fill, for small markers; pair it with text-n900. */
  fill: string;
  /** Subtle tinted background for cards and badges. */
  softBg: string;
  /** Subtle accent border. */
  border: string;
  /** Connector lines between timeline steps. */
  line: string;
}

export const SECTION_ACCENTS: Record<WorkspaceSectionKey, SectionAccent> = {
  techStack: {
    color: colors.section.techStack,
    text: "text-section-tech",
    fill: "bg-section-tech",
    softBg: "bg-section-tech/10",
    border: "border-section-tech/30",
    line: "bg-section-tech/30",
  },
  roadmap: {
    color: colors.section.roadmap,
    text: "text-section-roadmap",
    fill: "bg-section-roadmap",
    softBg: "bg-section-roadmap/10",
    border: "border-section-roadmap/30",
    line: "bg-section-roadmap/30",
  },
  architecture: {
    color: colors.section.architecture,
    text: "text-section-architecture",
    fill: "bg-section-architecture",
    softBg: "bg-section-architecture/10",
    border: "border-section-architecture/30",
    line: "bg-section-architecture/30",
  },
  learning: {
    color: colors.section.learning,
    text: "text-section-learning",
    fill: "bg-section-learning",
    softBg: "bg-section-learning/10",
    border: "border-section-learning/30",
    line: "bg-section-learning/30",
  },
};

export interface WorkspaceSectionConfig {
  key: WorkspaceSectionKey;
  label: string;
  Icon: LucideIcon;
  accent: SectionAccent;
  /**
   * Shown while the project is not ready yet. Blueprint sections are
   * generated on demand once it is.
   */
  preparingHint: string;
}

/** Display order of the workspace's internal sections. */
export const WORKSPACE_SECTIONS: readonly WorkspaceSectionConfig[] = [
  {
    key: "techStack",
    label: "Tech Stack",
    Icon: Layers,
    accent: SECTION_ACCENTS.techStack,
    preparingHint:
      "A recommended tech stack will be designed for your project once it is ready.",
  },
  {
    key: "roadmap",
    label: "Roadmap",
    Icon: Route,
    accent: SECTION_ACCENTS.roadmap,
    preparingHint:
      "A development roadmap will be designed for your project once it is ready.",
  },
  {
    key: "architecture",
    label: "Architecture",
    Icon: Network,
    accent: SECTION_ACCENTS.architecture,
    preparingHint:
      "An architecture will be designed for your project once it is ready.",
  },
  {
    key: "learning",
    label: "Learning",
    Icon: BookOpen,
    accent: SECTION_ACCENTS.learning,
    preparingHint:
      "Your required learning path will appear here once your project blueprint is generated.",
  },
];

/** Opening section for a project that is not ready; see getDefaultWorkspaceSection. */
export const DEFAULT_WORKSPACE_SECTION: WorkspaceSectionKey = "techStack";
