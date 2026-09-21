import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { ProjectLearningPanel } from "../../learning/components/ProjectLearningPanel";
import type { Project } from "../../projects/types/projects";
import { WORKSPACE_SECTIONS } from "../constants/sections";
import type { WorkspaceSectionKey } from "../types/workspace";
import { PreparingSection } from "./PreparingSection";
import { TechStackList } from "./TechStackList";

interface WorkspaceSectionPanelProps {
  project: Project;
  section: WorkspaceSectionKey;
}

/**
 * Learning renders the project's own curriculum. Only the tech stack has a
 * data field on Project today; roadmap and architecture stay in their
 * preparing state until blueprint generation exists.
 */
export function WorkspaceSectionPanel({ project, section }: WorkspaceSectionPanelProps) {
  const config = WORKSPACE_SECTIONS.find((candidate) => candidate.key === section);
  if (!config) return null;
  if (section === "learning") return <ProjectLearningPanel projectId={project.id} />;

  const { Icon, label } = config;
  const techStack = section === "techStack" ? project.techStack : undefined;

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <View className="flex-row items-center gap-2">
        <Icon size={20} color={colors.brand.auraPurple} strokeWidth={1.75} />
        <Text className="text-h3 text-white">{label}</Text>
      </View>

      {techStack?.length ? (
        <TechStackList technologies={techStack} />
      ) : (
        <PreparingSection section={config} />
      )}
    </View>
  );
}
