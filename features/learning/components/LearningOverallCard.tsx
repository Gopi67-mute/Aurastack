import { BookOpen } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { ProgressBar } from "../../home/components/ProgressBar";
import type { LearningSummary } from "../types/learning";

interface LearningOverallCardProps {
  summary: LearningSummary;
  title?: string;
}

export function LearningOverallCard({
  summary,
  title = "Overall",
}: LearningOverallCardProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${title}: ${summary.completed} of ${summary.total} topics completed, ${summary.percent}%`}
      className="rounded-xl border border-n600 bg-n800 p-4"
    >
      <View className="flex-row items-center gap-2">
        <BookOpen size={18} color={colors.brand.auraPurple} strokeWidth={2} />
        <Text className="text-h4 text-n100">{title}</Text>
      </View>
      <View className="mt-2 flex-row items-end justify-between">
        <View>
          <Text className="text-h1 text-white">
            {summary.completed} / {summary.total}
          </Text>
          <Text className="mt-1 text-body-md text-n300">topics completed</Text>
        </View>
        <Text className="text-h2 text-aura-blue">{summary.percent}%</Text>
      </View>
      <View className="mt-4">
        <ProgressBar
          value={summary.percent}
          accessibilityLabel={`${title} learning progress`}
        />
      </View>
    </View>
  );
}
