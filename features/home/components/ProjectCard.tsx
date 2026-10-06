import {
  ChevronRight,
  CodeXml,
  Layers,
  MessageSquare,
  ShoppingCart,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { getProjectCaption, getProjectSubtitle } from "../../projects/utils/projectDisplay";
import type { ProjectIconKey, RecentProject } from "../types/home";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { clampProgress } from "../utils/getAuraMessage";
import { ProgressBar } from "./ProgressBar";

export const PROJECT_ICONS:Record<ProjectIconKey, LucideIcon> = {
  commerce: ShoppingCart,
  chat: MessageSquare,
  web: CodeXml,
};

/** Neutral icon for projects that have no generated icon yet. */
export function getProjectIcon(iconKey?: ProjectIconKey | null): LucideIcon {
  return iconKey ? PROJECT_ICONS[iconKey] : Layers;
}

interface ProjectCardProps {
  project: RecentProject;
  onPress: () => void;
}

export function ProjectCard({ project, onPress }: ProjectCardProps) {
  const Icon = getProjectIcon(project.iconKey);
  const percent = clampProgress(project.progress);
  const createdLabel = formatRelativeTime(project.createdAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${percent}% complete, created ${createdLabel}`}
      className="flex-row items-center gap-3 rounded-xl border border-n600 bg-n800 p-3 active:opacity-80"
    >
      <View className="h-14 w-14 items-center justify-center rounded-lg bg-aura-purple/15">
        <Icon size={26} color={colors.brand.auraPurple} strokeWidth={1.75} />
      </View>

      <View className="flex-1">
        <Text className="text-h4 text-white" numberOfLines={1}>
          {project.name}
        </Text>
        <Text className="mt-1 text-body-sm text-n300" numberOfLines={1}>
          {getProjectSubtitle(project)}
        </Text>

        <View className="mt-2 flex-row items-center gap-3">
          <View className="flex-1">
            <ProgressBar
              value={percent}
              accessibilityLabel={`${project.name} progress`}
            />
          </View>
          <Text className="w-9 text-right text-caption text-n100">
            {percent}%
          </Text>
        </View>

        <Text className="mt-2 text-caption text-n300">
          {getProjectCaption(project, createdLabel)}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.neutral.n300} />
    </Pressable>
  );
}
