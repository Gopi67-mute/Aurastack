import { BookOpen } from "lucide-react-native";
import { Text, View } from "react-native";

import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintPhaseLearning } from "../types/blueprint";

const accent = SECTION_ACCENTS.learning;

interface PhaseLearningListProps {
  items: readonly BlueprintPhaseLearning[];
}

/**
 * The curriculum topics a roadmap phase applies, in the Learning accent so
 * they read as links to the learning plan. Titles come from the saved
 * curriculum; lesson content stays in Learning.
 */
export function PhaseLearningList({ items }: PhaseLearningListProps) {
  return (
    <View className={`gap-3 rounded-md border p-3 ${accent.border} ${accent.softBg}`}>
      <View className="flex-row items-center gap-2">
        <BookOpen size={14} color={accent.color} strokeWidth={2} />
        <Text className={`text-caption ${accent.text}`}>Learn & apply</Text>
      </View>
      {items.map((item) => (
        <View
          key={item.topicOrder}
          accessible
          accessibilityLabel={`Learning topic ${item.topicOrder}: ${item.topicTitle}. ${item.application}`}
        >
          <Text className="text-caption text-n300">Topic {item.topicOrder}</Text>
          <Text className="text-body-md text-white">{item.topicTitle}</Text>
          <Text className="mt-1 text-body-sm text-n300">{item.application}</Text>
        </View>
      ))}
    </View>
  );
}
