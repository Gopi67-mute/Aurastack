import { ArrowRight, CircleCheck } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { LearningTopic } from "../types/learning";

interface TopicCompletionActionsProps {
  /** The project's first incomplete topic; undefined once every topic is done. */
  nextTopic: LearningTopic | undefined;
  onOpenTopic: (topicId: string) => void;
  onBackToPlan: () => void;
}

/** Shown once a topic is completed, so the learning loop always has a way forward. */
export function TopicCompletionActions({
  nextTopic,
  onOpenTopic,
  onBackToPlan,
}: TopicCompletionActionsProps) {
  if (nextTopic) {
    const label = `Next: ${nextTopic.title}`;
    return (
      <Pressable
        onPress={() => onOpenTopic(nextTopic.id)}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple px-4 active:opacity-80"
      >
        <Text className="shrink text-body-md text-white" numberOfLines={1}>
          {label}
        </Text>
        <ArrowRight size={18} color={colors.neutral.white} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <View accessible accessibilityLabel="All topics completed" className="flex-row items-center gap-2">
        <CircleCheck size={20} color={colors.semantic.success} strokeWidth={2} />
        <Text className="text-h4 text-white">All topics completed</Text>
      </View>
      <Pressable
        onPress={onBackToPlan}
        accessibilityRole="button"
        accessibilityLabel="Back to plan"
        className="mt-4 h-12 items-center justify-center rounded-lg bg-aura-purple active:opacity-80"
      >
        <Text className="text-body-md text-white">Back to plan</Text>
      </Pressable>
    </View>
  );
}
