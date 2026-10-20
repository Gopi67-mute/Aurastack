import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import type { RemoteStatus } from "../../../lib/remoteData";
import { colors } from "../../../theme/colors";
import type { Project } from "../../projects/types/projects";

interface ProjectContextSelectorProps {
  projects: readonly Project[];
  status: RemoteStatus;
  selectedProject: Project | null;
  onSelect: (projectId: string | null) => void;
  onRetry: () => void;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function ContextChip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      className={`min-h-11 max-w-56 justify-center rounded-full border px-4 active:opacity-80 ${
        selected ? "border-aura-purple bg-aura-purple/20" : "border-n600 bg-n800"
      }`}
    >
      <Text numberOfLines={1} className={`text-body-sm ${selected ? "text-white" : "text-n300"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Chooses what the mentor is grounded in: general mentoring or one of the
 * user's projects. Only the selected project's context is ever sent.
 */
export function ProjectContextSelector({
  projects,
  status,
  selectedProject,
  onSelect,
  onRetry,
}: ProjectContextSelectorProps) {
  const isFirstLoad = projects.length === 0 && (status === "idle" || status === "loading");

  const note = selectedProject
    ? `Answers use ${selectedProject.name}'s details, blueprint and learning progress when available.`
    : projects.length === 0 && status === "ready"
      ? "Create a project to get answers grounded in its blueprint and progress."
      : "General engineering help. No project details are shared.";

  return (
    <View className="mt-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Mentoring context"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        <ContextChip label="General" selected={!selectedProject} onPress={() => onSelect(null)} />
        {projects.map((project) => (
          <ContextChip
            key={project.id}
            label={project.name}
            selected={selectedProject?.id === project.id}
            onPress={() => onSelect(project.id)}
          />
        ))}
        {isFirstLoad ? (
          <View
            accessible
            accessibilityLabel="Loading projects"
            className="min-h-11 flex-row items-center gap-2 rounded-full border border-n600 px-4"
          >
            <ActivityIndicator size="small" color={colors.brand.auraPurple} />
            <Text className="text-body-sm text-n300">Loading projects…</Text>
          </View>
        ) : null}
        {projects.length === 0 && status === "error" ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Couldn't load projects. Try again"
            className="min-h-11 justify-center rounded-full border border-error/60 px-4 active:opacity-80"
          >
            <Text className="text-body-sm text-n100">Couldn't load projects · Retry</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Text className="mt-2 px-4 text-caption text-n300">{note}</Text>
    </View>
  );
}
