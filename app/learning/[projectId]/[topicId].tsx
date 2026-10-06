import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CircleCheck } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { LearningScreenHeader } from "../../../features/learning/components/LearningScreenHeader";
import { TopicCompletionActions } from "../../../features/learning/components/TopicCompletionActions";
import { TopicSection } from "../../../features/learning/components/TopicSection";
import { useLearningTopic } from "../../../features/learning/hooks/useLearningTopic";
import { getNextTopic } from "../../../features/learning/utils/getNextTopic";
import { getParam } from "../../../features/learning/utils/getParam";
import { colors } from "../../../theme/colors";

// A single learning topic for one project, opened by projectId + topicId.
export default function LearningTopicScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    projectId?: string | string[];
    topicId?: string | string[];
  }>();
  const { project, topic, status, error, isCompleting, completeError, markCompleted } =
    useLearningTopic(getParam(params.projectId), getParam(params.topicId));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/learning"));
  const isCompleted = topic?.status === "completed";
  const nextTopic = project ? getNextTopic(project.topics) : undefined;

  // Replace rather than push, so moving through a plan never piles topics on the stack.
  const openTopic = (nextTopicId: string) => {
    if (!project) return;
    router.replace({
      pathname: "/learning/[projectId]/[topicId]",
      params: { projectId: project.projectId, topicId: nextTopicId },
    });
  };
  const backToPlan = () => {
    if (!project) return;
    router.replace({ pathname: "/learning/[projectId]", params: { projectId: project.projectId } });
  };
  const isLoading = !topic && (status === "idle" || status === "loading");

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
          title={topic?.title ?? "Learning"}
          subtitle={project?.projectName}
          onBack={goBack}
        />

        {isLoading ? (
          <View className="mt-6">
            <LoadingState label="topic" />
          </View>
        ) : !topic && status === "error" ? (
          <View className="mt-6">
            <ErrorState message={error ?? "Couldn't load this topic."} />
          </View>
        ) : topic ? (
          <View className="mt-6 gap-3">
            <TopicSection title="What is it?" body={topic.content.what} />
            <TopicSection title="Why does this project need it?" body={topic.content.why} />
            <TopicSection title="How it works" body={topic.content.how} />
            <TopicSection title="Example" body={topic.content.example} />
            <TopicSection title="How it applies to this project" body={topic.content.apply} />
            {topic.content.miniTask ? (
              <TopicSection title="Mini task (optional)" body={topic.content.miniTask} />
            ) : null}

            {/* Disabled while in flight so a double press cannot fire a second
                request; the backend is idempotent regardless. */}
            <Pressable
              onPress={markCompleted}
              disabled={isCompleted || isCompleting}
              accessibilityRole="button"
              accessibilityLabel={isCompleted ? "Topic completed" : "Mark as completed"}
              accessibilityState={{ disabled: isCompleted || isCompleting, busy: isCompleting }}
              className={`mt-3 h-12 flex-row items-center justify-center gap-2 rounded-lg ${
                isCompleted
                  ? "border border-n600 bg-n800"
                  : `bg-aura-purple ${isCompleting ? "opacity-60" : "active:opacity-80"}`
              }`}
            >
              {isCompleted ? (
                <CircleCheck size={18} color={colors.semantic.success} strokeWidth={2} />
              ) : null}
              {isCompleting ? <ActivityIndicator size="small" color={colors.neutral.white} /> : null}
              <Text className="text-body-md text-white">
                {isCompleted ? "Completed" : isCompleting ? "Saving..." : "Mark as completed"}
              </Text>
            </Pressable>

            {/* The completion did not persist, so never leave it looking saved. */}
            {completeError ? <ErrorState message={completeError} onRetry={markCompleted} /> : null}

            {isCompleted ? (
              <TopicCompletionActions
                nextTopic={nextTopic}
                onOpenTopic={openTopic}
                onBackToPlan={backToPlan}
              />
            ) : null}
          </View>
        ) : (
          <Text className="mt-6 text-body-md text-n300">
            We could not find this topic. Go back and pick another one.
          </Text>
        )}
      </ScrollView>
    </>
  );
}
