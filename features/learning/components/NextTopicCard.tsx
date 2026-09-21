import { Pressable, Text, View } from "react-native";

import type { LearningTopic } from "../types/learning";

interface NextTopicCardProps {
  topic: LearningTopic;
  onPress: () => void;
}

/** The project's first incomplete topic, with a direct way into it. */
export function NextTopicCard({ topic, onPress }: NextTopicCardProps) {
  const actionLabel = topic.status === "in_progress" ? "Continue learning" : "Start learning";

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <Text className="text-caption uppercase text-n300">Next topic</Text>
      <Text className="mt-2 text-h3 text-white">{topic.title}</Text>
      <Text className="mt-1 text-body-md text-n300">{topic.description}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}: ${topic.title}`}
        className="mt-4 h-12 items-center justify-center rounded-lg bg-aura-purple active:opacity-80"
      >
        <Text className="text-body-md text-white">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
