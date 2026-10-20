import { BookOpen, CircleCheck, Flag } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { ActivityEvent, ActivityType } from "../types/progress";
import { formatActivityDay } from "../utils/progressStats";

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  task: CircleCheck,
  learning: BookOpen,
  milestone: Flag,
};

interface ActivityItemProps {
  event: ActivityEvent;
}

export function ActivityItem({ event }: ActivityItemProps) {
  const Icon = ACTIVITY_ICONS[event.type];
  const when = formatActivityDay(event.occurredAt);
  const caption = event.projectName ? `${event.projectName} · ${when}` : when;

  return (
    <View
      accessible
      accessibilityLabel={`${event.description}, ${caption}`}
      className="flex-row items-center gap-3 rounded-xl border border-n600 bg-n800 p-3"
    >
      <View className="h-10 w-10 items-center justify-center rounded-md bg-aura-purple/15">
        <Icon size={20} color={colors.brand.auraPurple} strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-body-md text-white" numberOfLines={2}>
          {event.description}
        </Text>
        <Text className="mt-1 text-caption text-n300" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
