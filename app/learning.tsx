import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContinueLearningCard } from "../features/learning/components/ContinueLearningCard";
import { LearningOverallCard } from "../features/learning/components/LearningOverallCard";
import { LearningScreenHeader } from "../features/learning/components/LearningScreenHeader";
import { ProjectLearningCard } from "../features/learning/components/ProjectLearningCard";
import { useLearningOverview } from "../features/learning/hooks/useLearningOverview";

// Global learning overview across all projects. Not the per-project Learning tab.
export default function Learning() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { overall, projects } = useLearningOverview();
  const inProgress = projects.filter(({ nextTopic }) => nextTopic !== undefined);

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
        <LearningScreenHeader
          title="Learning"
          subtitle="Build the knowledge you need to build your projects."
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        />

        <Text className="mt-6 text-h3 text-white">Your Learning</Text>
        <View className="mt-3">
          <LearningOverallCard summary={overall} />
        </View>

        {projects.length === 0 ? (
          <View className="mt-6 rounded-xl border border-n600 bg-n800 p-4">
            <Text className="text-h4 text-white">No projects yet</Text>
            <Text className="mt-1 text-body-sm text-n300">
              Create a project to get its learning path.
            </Text>
            <Pressable
              onPress={() => router.push("/create-project")}
              accessibilityRole="button"
              accessibilityLabel="Create a project"
              className="mt-4 h-12 items-center justify-center rounded-lg bg-aura-purple active:opacity-80"
            >
              <Text className="text-body-md text-white">Create a project</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="mt-6 text-h3 text-white">Continue Learning</Text>
            {inProgress.length === 0 ? (
              <Text className="mt-3 text-body-md text-n300">
                {overall.total > 0
                  ? "You have completed every topic. Great work!"
                  : "Learning plans are being prepared."}
              </Text>
            ) : (
              <View className="mt-3 gap-3">
                {inProgress.map(({ project, summary, nextTopic }) =>
                  nextTopic ? (
                    <ContinueLearningCard
                      key={project.projectId}
                      project={project}
                      summary={summary}
                      nextTopic={nextTopic}
                      onPress={() =>
                        router.push({
                          pathname: "/learning/[projectId]/[topicId]",
                          params: { projectId: project.projectId, topicId: nextTopic.id },
                        })
                      }
                    />
                  ) : null,
                )}
              </View>
            )}

            <Text className="mt-6 text-h3 text-white">All Projects</Text>
            <View className="mt-3 gap-3">
              {projects.map(({ project, summary }) => (
                <ProjectLearningCard
                  key={project.projectId}
                  project={project}
                  summary={summary}
                  onPress={() =>
                    router.push({
                      pathname: "/learning/[projectId]",
                      params: { projectId: project.projectId },
                    })
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
