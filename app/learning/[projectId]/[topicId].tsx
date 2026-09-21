import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CircleCheck } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LearningScreenHeader } from "../../../features/learning/components/LearningScreenHeader";
import { TopicSection } from "../../../features/learning/components/TopicSection";
import { useLearningTopic } from "../../../features/learning/hooks/useLearningTopic";
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
  const { project, topic, markCompleted } = useLearningTopic(
    getParam(params.projectId),
    getParam(params.topicId),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/learning"));
  const isCompleted = topic?.status === "completed";

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

        {topic ? (
          <View className="mt-6 gap-3">
            <TopicSection title="What is it?" body={topic.content.what} />
            <TopicSection title="Why does this project need it?" body={topic.content.why} />
            <TopicSection title="How it works" body={topic.content.how} />
            <TopicSection title="Example" body={topic.content.example} />
            <TopicSection title="How it applies to this project" body={topic.content.apply} />
            {topic.content.miniTask ? (
              <TopicSection title="Mini task (optional)" body={topic.content.miniTask} />
            ) : null}

            <Pressable
              onPress={markCompleted}
              disabled={isCompleted}
              accessibilityRole="button"
              accessibilityLabel={isCompleted ? "Topic completed" : "Mark as completed"}
              accessibilityState={{ disabled: isCompleted }}
              className={`mt-3 h-12 flex-row items-center justify-center gap-2 rounded-lg ${
                isCompleted ? "border border-n600 bg-n800" : "bg-aura-purple active:opacity-80"
              }`}
            >
              {isCompleted ? (
                <CircleCheck size={18} color={colors.semantic.success} strokeWidth={2} />
              ) : null}
              <Text className="text-body-md text-white">
                {isCompleted ? "Completed" : "Mark as completed"}
              </Text>
            </Pressable>
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
