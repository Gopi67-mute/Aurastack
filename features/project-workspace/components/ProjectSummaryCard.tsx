import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { getProjectIcon } from "../../home/components/ProjectCard";
import { ProgressBar } from "../../home/components/ProgressBar";
import { formatRelativeTime } from "../../home/utils/formatRelativeTime";
import { clampProgress } from "../../home/utils/getAuraMessage";
import type { Project } from "../../projects/types/projects";
import { getProjectStatusLabel, getProjectSubtitle } from "../../projects/utils/projectDisplay";

interface ProjectSummaryCardProps {
  project: Project;
}

export function ProjectSummaryCard({ project }: ProjectSummaryCardProps) {
  const Icon = getProjectIcon(project.iconKey);
  const percent = clampProgress(project.progress);
  const statusLine =
    getProjectStatusLabel(project) ?? `Created ${formatRelativeTime(project.createdAt)}`;

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-n600 bg-n800 p-4">
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

        <View className="mt-3 flex-row items-center gap-3">
          <View className="flex-1">
            <ProgressBar value={percent} accessibilityLabel={`${project.name} progress`} />
          </View>
          <Text className="w-9 text-right text-caption text-n100">{percent}%</Text>
        </View>

        <Text className="mt-2 text-caption text-n300">{statusLine}</Text>
      </View>
    </View>
  );
}
