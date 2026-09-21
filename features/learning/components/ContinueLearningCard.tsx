import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { ProgressBar } from "../../home/components/ProgressBar";
import type { LearningSummary, LearningTopic, ProjectLearning } from "../types/learning";

interface ContinueLearningCardProps {
  project: ProjectLearning;
  summary: LearningSummary;
  nextTopic: LearningTopic;
  onPress: () => void;
}

/** A project's progress plus a shortcut to its next incomplete topic. */
export function ContinueLearningCard({
  project,
  summary,
  nextTopic,
  onPress,
}: ContinueLearningCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${project.projectName}, ${summary.completed} of ${summary.total} topics, ${summary.percent}% complete. Continue with ${nextTopic.title}`}
      className="rounded-xl border border-n600 bg-n800 p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-h4 text-white" numberOfLines={1}>
          {project.projectName}
        </Text>
        <Text className="ml-3 text-body-sm text-n100">{summary.percent}%</Text>
      </View>
      <Text className="mt-1 text-body-sm text-n300">
        {summary.completed} / {summary.total} topics
      </Text>
      <View className="mt-3">
        <ProgressBar
          value={summary.percent}
          accessibilityLabel={`${project.projectName} learning progress`}
        />
      </View>

      <View className="mt-4 flex-row items-center justify-between rounded-lg bg-aura-purple/15 px-3 py-3">
        <View className="flex-1">
          <Text className="text-caption uppercase text-n300">Continue</Text>
          <Text className="mt-1 text-body-md text-white" numberOfLines={1}>
            {nextTopic.title}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.brand.auraPurple} />
      </View>
    </Pressable>
  );
}
