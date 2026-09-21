import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityItem } from "../features/progress/components/ActivityItem";
import { StreakCard } from "../features/progress/components/StreakCard";
import { WeeklyStats } from "../features/progress/components/WeeklyStats";
import { useProgressOverview } from "../features/progress/hooks/useProgressOverview";
import { colors } from "../theme/colors";

// Global development momentum across all projects. Not a single project's progress.
export default function Progress() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { streakDays, week, weekly, recentActivity } = useProgressOverview();

  return (
    <>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1 bg-n900"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-n600 bg-n800 active:opacity-80"
        >
          <ChevronLeft size={20} color={colors.neutral.white} />
        </Pressable>

        <Text className="text-h1 text-white">Your Progress</Text>
        <Text className="mt-1 text-body-md text-n300">
          See your development momentum and recent activity.
        </Text>

        <View className="mt-6">
          <StreakCard streakDays={streakDays} week={week} />
        </View>

        <Text className="mt-6 text-h3 text-white">Last 7 days</Text>
        <View className="mt-3">
          <WeeklyStats totals={weekly} />
        </View>

        <Text className="mt-6 text-h3 text-white">Recent activity</Text>
        {recentActivity.length === 0 ? (
          <Text className="mt-3 text-body-md text-n300">
            No activity yet. Complete a task to see it here.
          </Text>
        ) : (
          <View className="mt-3 gap-3">
            {recentActivity.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </View>
        )}
      </ScrollView>
    </>
  );
}
