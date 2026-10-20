import { Text, View } from "react-native";

import { ProjectLearningPanel } from "../../learning/components/ProjectLearningPanel";
import type { Project } from "../../projects/types/projects";
import { WORKSPACE_SECTIONS } from "../constants/sections";
import type { WorkspaceSectionConfig } from "../constants/sections";
import { useProjectBlueprint } from "../hooks/useProjectBlueprint";
import type { WorkspaceSectionKey } from "../types/workspace";
import { BlueprintState } from "./BlueprintState";
import { PreparingSection } from "./PreparingSection";

interface WorkspaceSectionPanelProps {
  project: Project;
  section: WorkspaceSectionKey;
}

/**
 * Learning renders the project's own curriculum. Tech stack, roadmap and
 * architecture come from the project's blueprint, which is only read (and
 * generated on demand) while one of them is open on a ready project, so
 * opening Learning never triggers it. Until the project is ready they stay
 * in their preparing state.
 */
export function WorkspaceSectionPanel({ project, section }: WorkspaceSectionPanelProps) {
  const isReady = project.status === "ready";
  const blueprint = useProjectBlueprint(project.id, isReady && section !== "learning");

  const config = WORKSPACE_SECTIONS.find((candidate) => candidate.key === section);
  if (!config) return null;

  if (section === "learning") {
    return (
      <View className="gap-4">
        <SectionHeader
          config={config}
          subtitle="Each topic is applied in a phase of your Roadmap."
        />
        <ProjectLearningPanel projectId={project.id} />
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <SectionHeader config={config} />

      {isReady ? (
        <BlueprintState
          section={section}
          status={blueprint.status}
          blueprint={blueprint.blueprint}
          error={blueprint.error}
          onRetry={blueprint.retry}
          onRefresh={blueprint.refresh}
        />
      ) : (
        <PreparingSection section={config} />
      )}
    </View>
  );
}

function SectionHeader({ config, subtitle }: { config: WorkspaceSectionConfig; subtitle?: string }) {
  const { Icon, label, accent } = config;
  return (
    <View className="flex-row items-center gap-3">
      <View className={`h-8 w-8 items-center justify-center rounded-md ${accent.softBg}`}>
        <Icon size={18} color={accent.color} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-h3 text-white">
          {label}
        </Text>
        {subtitle ? <Text className="text-body-sm text-n300">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
