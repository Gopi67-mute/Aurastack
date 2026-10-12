import { ChevronRight, Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { Project } from "../../projects/types/projects";
import type { RecentProfileProject } from "../types/profile";
import { RecentProjectRow } from "./RecentProjectRow";

interface ProfileRecentProjectsProps {
  items: readonly RecentProfileProject[];
  onViewAllPress: () => void;
  onProjectPress: (project: Project) => void;
  onCreatePress: () => void;
}

export function ProfileRecentProjects({
  items,
  onViewAllPress,
  onProjectPress,
  onCreatePress,
}: ProfileRecentProjectsProps) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 px-4 pt-4 pb-1">
      <View className="flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-h3 text-white">
          Recent Projects
        </Text>
        {items.length > 0 ? (
          <Pressable
            onPress={onViewAllPress}
            accessibilityRole="button"
            accessibilityLabel="View all projects"
            hitSlop={8}
            className="min-h-10 flex-row items-center gap-1"
          >
            <Text className="text-h4 text-ai-accent">View all</Text>
            <ChevronRight size={16} color={colors.semantic.aiAccent} />
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <View className="items-center pt-4 pb-4">
          <Text className="text-body-md text-n300 text-center">
            No projects yet. Your most recent projects will show up here.
          </Text>
          <Pressable
            onPress={onCreatePress}
            accessibilityRole="button"
            accessibilityLabel="Create a project"
            className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple px-6 active:opacity-80"
          >
            <Plus size={18} color={colors.neutral.white} strokeWidth={2.5} />
            <Text className="text-body-md text-white">Create a project</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-1">
          {items.map((item, index) => (
            <RecentProjectRow
              key={item.project.id}
              item={item}
              index={index}
              onPress={() => onProjectPress(item.project)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
