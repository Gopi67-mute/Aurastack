import { ChevronRight, CircleCheck, Circle, CircleDot } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text } from "react-native";

import { colors } from "../../../theme/colors";
import type { LearningTopic, TopicStatus } from "../types/learning";

const STATUS_ICONS: Record<TopicStatus, LucideIcon> = {
  completed: CircleCheck,
  in_progress: CircleDot,
  not_started: Circle,
};

const STATUS_LABELS: Record<TopicStatus, string> = {
  completed: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
};

interface TopicRowProps {
  topic: LearningTopic;
  onPress: () => void;
}

export function TopicRow({ topic, onPress }: TopicRowProps) {
  const Icon = STATUS_ICONS[topic.status];
  const iconColor =
    topic.status === "completed" ? colors.semantic.success : colors.brand.auraPurple;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${topic.title}, ${STATUS_LABELS[topic.status]}`}
      className="flex-row items-center gap-3 rounded-xl border border-n600 bg-n800 p-3 active:opacity-80"
    >
      <Icon size={20} color={iconColor} strokeWidth={2} />
      <Text className="flex-1 text-body-md text-white" numberOfLines={2}>
        {topic.title}
      </Text>
      <Text className="text-caption text-n300">{STATUS_LABELS[topic.status]}</Text>
      <ChevronRight size={18} color={colors.neutral.n300} />
    </Pressable>
  );
}
