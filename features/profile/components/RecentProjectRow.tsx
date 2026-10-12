import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { getProjectIcon } from "../../home/components/ProjectCard";
import { formatRelativeTime } from "../../home/utils/formatRelativeTime";
import type { ProjectActivityKind, RecentProfileProject } from "../types/profile";

const ACTIVITY_LABELS: Record<ProjectActivityKind, string> = {
  studied: "Last studied",
  created: "Created",
};

/** Static class strings (NativeWind needs them whole); cycled by row position. */
const ICON_TILES = [
  { className: "bg-aura-purple/15", color: colors.brand.auraPurple },
  { className: "bg-aura-blue/15", color: colors.brand.auraBlue },
  { className: "bg-aura-teal/15", color: colors.brand.auraTeal },
] as const;

interface RecentProjectRowProps {
  item: RecentProfileProject;
  index: number;
  onPress: () => void;
}

export function RecentProjectRow({ item, index, onPress }: RecentProjectRowProps) {
  const { project, activityKind, activityAt } = item;
  const Icon = getProjectIcon(project.iconKey);
  const tile = ICON_TILES[index % ICON_TILES.length];
  const activity = `${ACTIVITY_LABELS[activityKind]} ${formatRelativeTime(activityAt).toLowerCase()}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.name}, ${activity}`}
      accessibilityHint="Opens the project"
      className={`min-h-16 flex-row items-center gap-3 py-3 active:opacity-80 ${
        index > 0 ? "border-t border-n600" : ""
      }`}
    >
      <View className={`h-12 w-12 items-center justify-center rounded-lg ${tile.className}`}>
        <Icon size={22} color={tile.color} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text className="text-h4 text-white" numberOfLines={1}>
          {project.name}
        </Text>
        <Text className="mt-1 text-body-sm text-n300" numberOfLines={1}>
          {activity}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.neutral.n300} />
    </Pressable>
  );
}
