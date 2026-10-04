import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { HomeHeader } from "../../features/home/components/HomeHeader";
import { OverallProgressCard } from "../../features/home/components/OverallProgressCard";
import { RecentProjectsSection } from "../../features/home/components/RecentProjectsSection";
import { SummaryCards } from "../../features/home/components/SummaryCards";
import { useHomeData } from "../../features/home/hooks/useHomeData";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, status, error, refresh } = useHomeData();
  const isFirstLoad = data.recentProjects.length === 0 && (status === "idle" || status === "loading");

  return (
    <>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1 bg-n900"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader />

        {isFirstLoad ? (
          <View className="mt-6">
            <LoadingState label="your dashboard" />
          </View>
        ) : (
          <>
            {/* Figures below may be partial when a read failed, so say so. */}
            {status === "error" && error ? (
              <View className="mt-6">
                <ErrorState message={error} onRetry={refresh} />
              </View>
            ) : null}
            <View className="mt-6 gap-4">
              <OverallProgressCard progress={data.overallProgress} />
              <SummaryCards
                projects={data.projects}
                learning={data.learning}
                momentum={data.momentum}
                onProjectsPress={() => router.navigate("/projects")}
                onLearningPress={() => router.navigate("/learning")}
                onMomentumPress={() => router.navigate("/progress")}
              />
            </View>
            <View className="mt-6">
              <RecentProjectsSection
                projects={data.recentProjects}
                onViewAllPress={() => router.navigate("/projects")}
                onProjectPress={(project) =>
                  router.push({
                    pathname: "/projects/[projectId]",
                    params: { projectId: project.id },
                  })
                }
                onCreatePress={() => router.push("/create-project")}
              />
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
