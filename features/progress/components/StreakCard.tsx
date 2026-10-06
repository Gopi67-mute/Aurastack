import { Check, Circle, Flame } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { WeekDay } from "../types/progress";

interface StreakCardProps {
  streakDays: number;
  week: readonly WeekDay[];
}

export function StreakCard({ streakDays, week }: StreakCardProps) {
  const message =
    streakDays > 0
      ? "Keep the momentum going!"
      : "Complete a learning topic today to start a streak.";

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-lg bg-warning/15">
          <Flame size={26} color={colors.semantic.warning} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text className="text-h2 text-white">
            {streakDays} day{streakDays === 1 ? "" : "s"} streak
          </Text>
          <Text className="mt-1 text-body-sm text-n300">{message}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row justify-between">
        {week.map((day) => (
          <View
            key={day.label}
            accessible
            accessibilityLabel={`${day.label}: ${day.active ? "active" : "no activity"}`}
            className="items-center gap-2"
          >
            <Text className={`text-caption ${day.isToday ? "text-white" : "text-n300"}`}>
              {day.label}
            </Text>
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${
                day.active ? "bg-aura-purple" : "border border-n600 bg-n700"
              }`}
            >
              {day.active ? (
                <Check size={16} color={colors.neutral.white} strokeWidth={3} />
              ) : (
                <Circle size={12} color={colors.neutral.n300} strokeWidth={2} />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
