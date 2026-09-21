import { Text, View } from "react-native";

import type { WeeklyTotals } from "../types/progress";

interface WeeklyStatsProps {
  totals: WeeklyTotals;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 rounded-xl border border-n600 bg-n800 p-3"
    >
      <Text className="text-h2 text-white">{value}</Text>
      <Text className="mt-1 text-caption text-n300">{label}</Text>
    </View>
  );
}

export function WeeklyStats({ totals }: WeeklyStatsProps) {
  return (
    <View className="flex-row gap-3">
      <Stat label="Tasks completed" value={totals.tasks} />
      <Stat label="Learning topics" value={totals.topics} />
      <Stat label="Milestones completed" value={totals.milestones} />
    </View>
  );
}
