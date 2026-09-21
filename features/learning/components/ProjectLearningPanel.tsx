import { useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { useProjectLearning } from "../hooks/useProjectLearning";
import { LearningOverallCard } from "./LearningOverallCard";
import { NextTopicCard } from "./NextTopicCard";
import { TopicRow } from "./TopicRow";

interface ProjectLearningPanelProps {
  projectId: string;
}

/**
 * One project's curriculum: progress, next topic and the ordered topic list.
 * Rendered by both the workspace Learning tab and /learning/[projectId], so
 * they always show the same data for the same project id.
 */
export function ProjectLearningPanel({ projectId }: ProjectLearningPanelProps) {
  const router = useRouter();
  const { project, summary, nextTopic } = useProjectLearning(projectId);

  if (!project) {
    return (
      <Text className="text-body-md text-n300">
        We could not find learning topics for this project.
      </Text>
    );
  }

  if (project.topics.length === 0) {
    return (
      <View className="rounded-xl border border-n600 bg-n800 p-4">
        <Text className="text-h4 text-white">Learning plan is being prepared.</Text>
        <Text className="mt-1 text-body-sm text-n300">
          Your topics will appear here once they are ready.
        </Text>
      </View>
    );
  }

  const openTopic = (topicId: string) =>
    router.push({ pathname: "/learning/[projectId]/[topicId]", params: { projectId, topicId } });

  return (
    <View className="gap-4">
      <Text className="text-body-md text-n300">
        Learn the concepts needed to build this project.
      </Text>
      <LearningOverallCard summary={summary} title="Learning Progress" />

      {nextTopic ? (
        <NextTopicCard topic={nextTopic} onPress={() => openTopic(nextTopic.id)} />
      ) : (
        <View
          accessible
          accessibilityLabel="All topics completed"
          className="flex-row items-center gap-2 rounded-xl border border-n600 bg-n800 p-4"
        >
          <CircleCheck size={20} color={colors.semantic.success} strokeWidth={2} />
          <Text className="text-body-md text-white">All topics completed</Text>
        </View>
      )}

      <Text className="text-h3 text-white">Topics</Text>
      <View className="gap-3">
        {project.topics.map((topic) => (
          <TopicRow key={topic.id} topic={topic} onPress={() => openTopic(topic.id)} />
        ))}
      </View>
    </View>
  );
}
