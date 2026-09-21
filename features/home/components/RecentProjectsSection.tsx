import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { RecentProject } from "../types/home";
import { ProjectCard } from "./ProjectCard";
import { RecentProjectsEmpty } from "./RecentProjectsEmpty";

interface RecentProjectsSectionProps {
  projects: readonly RecentProject[];
  onViewAllPress: () => void;
  onProjectPress: (project: RecentProject) => void;
  onCreatePress: () => void;
}

export function RecentProjectsSection({
  projects,
  onViewAllPress,
  onProjectPress,
  onCreatePress,
}: RecentProjectsSectionProps) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-h3 text-white">Recent projects</Text>
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
      </View>

      <View className="mt-3 gap-3">
        {projects.length === 0 ? (
          <RecentProjectsEmpty onCreatePress={onCreatePress} />
        ) : (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onPress={() => onProjectPress(project)}
            />
          ))
        )}
      </View>
    </View>
  );
}
