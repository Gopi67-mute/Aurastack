import { ChevronRight, CircleCheck } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { getProjectIcon } from "../../home/components/ProjectCard";
import { ProgressBar } from "../../home/components/ProgressBar";
import type { LearningSummary, ProjectLearning } from "../types/learning";

interface ProjectLearningCardProps {
  project: ProjectLearning;
  summary: LearningSummary;
  onPress: () => void;
}

export function ProjectLearningCard({
  project,
  summary,
  onPress,
}: ProjectLearningCardProps) {
  const Icon = getProjectIcon(project.iconKey);
  const hasTopics = summary.total > 0;
  const isCompleted = hasTopics && summary.completed === summary.total;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.projectName}, ${summary.completed} of ${summary.total} topics, ${summary.percent}% complete${isCompleted ? ", completed" : ""}`}
      className="flex-row items-center gap-3 rounded-xl border border-n600 bg-n800 p-3 active:opacity-80"
    >
      <View className="h-14 w-14 items-center justify-center rounded-lg bg-aura-purple/15">
        <Icon size={26} color={colors.brand.auraPurple} strokeWidth={1.75} />
      </View>

      <View className="flex-1">
        <Text className="text-h4 text-white" numberOfLines={1}>
          {project.projectName}
        </Text>
        {hasTopics ? (
          <>
            <Text className="mt-1 text-body-sm text-n300">
              {summary.completed} / {summary.total} topics
            </Text>
            <View className="mt-2 flex-row items-center gap-3">
              <View className="flex-1">
                <ProgressBar
                  value={summary.percent}
                  accessibilityLabel={`${project.projectName} learning progress`}
                />
              </View>
              <Text className="w-9 text-right text-caption text-n100">
                {summary.percent}%
              </Text>
            </View>
          </>
        ) : (
          <Text className="mt-1 text-body-sm text-n300">Learning plan is being prepared.</Text>
        )}
      </View>

      {isCompleted ? (
        <CircleCheck size={18} color={colors.semantic.success} strokeWidth={2} />
      ) : (
        <ChevronRight size={18} color={colors.neutral.n300} />
      )}
    </Pressable>
  );
}
