import { BookOpen, FolderOpen, History, TrendingUp } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { ProfileStats } from "../types/profile";
import { RECENT_WINDOW_DAYS } from "../utils/profileStats";

const UNAVAILABLE = "—";

interface StatDefinition {
  key: keyof ProfileStats;
  label: string;
  icon: LucideIcon;
  color: string;
}

const STATS: readonly StatDefinition[] = [
  { key: "totalProjects", label: "Total Projects", icon: FolderOpen, color: colors.brand.auraPurple },
  { key: "recentProjects", label: "Recent Projects", icon: History, color: colors.brand.auraTeal },
  { key: "learningPaths", label: "Learning Paths", icon: BookOpen, color: colors.brand.auraBlue },
  { key: "inProgress", label: "In Progress", icon: TrendingUp, color: colors.semantic.aiAccent },
];

interface WorkspaceStatsCardProps {
  stats: ProfileStats;
}

/** Four workspace figures; one whose data has not loaded reads "—", never 0. */
export function WorkspaceStatsCard({ stats }: WorkspaceStatsCardProps) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 px-2 py-4">
      <View className="flex-row">
        {STATS.map(({ key, label, icon: Icon, color }, index) => {
          const value = stats[key];
          return (
            <View
              key={key}
              accessible
              accessibilityLabel={value === null ? `${label}, not available` : `${label}, ${value}`}
              className={`flex-1 items-center px-1 ${index > 0 ? "border-l border-n600" : ""}`}
            >
              <Icon size={22} color={color} strokeWidth={1.75} />
              <Text className="mt-2 text-h3 text-white">{value ?? UNAVAILABLE}</Text>
              <Text className="mt-1 text-caption text-n300 text-center" numberOfLines={2}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text className="mt-4 px-2 text-caption text-n300 text-center">
        Recent: created or studied in the last {RECENT_WINDOW_DAYS} days.
      </Text>
    </View>
  );
}
