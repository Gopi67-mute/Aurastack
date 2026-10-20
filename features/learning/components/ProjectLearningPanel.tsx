import { useRouter } from "expo-router";
import { CircleCheck } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { colors } from "../../../theme/colors";
import { useProjectById } from "../../project-workspace/hooks/useProjectById";
import { useLearningData } from "../hooks/useLearningData";
import { useProjectLearning } from "../hooks/useProjectLearning";
import { LearningOverallCard } from "./LearningOverallCard";
import { NextTopicCard } from "./NextTopicCard";
import { TopicRow } from "./TopicRow";

const EMPTY_PLAN_ERROR = "This learning plan is unexpectedly empty. Try loading it again.";

interface ProjectLearningPanelProps {
  projectId: string;
  /**
   * Offer a link to the project workspace, where a failed generation is
   * retried. Off inside the workspace, which already shows that retry card.
   */
  linkToProject?: boolean;
}

/**
 * One project's curriculum: progress, next topic and the ordered topic list.
 * Rendered by both the workspace Learning tab and /learning/[projectId], so
 * they always show the same data for the same project id.
 *
 * Generation state comes from the server's project status, never from the
 * topic count: a generating project has no topics yet, and may not even be
 * in the learning list until its curriculum is ready.
 */
export function ProjectLearningPanel({ projectId, linkToProject = false }: ProjectLearningPanelProps) {
  const router = useRouter();
  const { project, summary, nextTopic, status, error } = useProjectLearning(projectId);
  const { project: serverProject, status: projectsStatus } = useProjectById(projectId);
  const { refresh } = useLearningData();

  if (serverProject?.status === "generating") {
    return (
      <PlanNotice
        title="Generating your learning plan…"
        message="Your topics will appear here once they are ready."
      />
    );
  }

  if (serverProject?.status === "failed") {
    return (
      <PlanNotice
        title="We couldn't generate this learning plan."
        message={
          linkToProject
            ? "Your project is saved. Open it to try generating the plan again."
            : "Your project is saved. Use Try again above to generate the plan again."
        }
      >
        {linkToProject ? (
          <Pressable
            onPress={() => router.push({ pathname: "/projects/[projectId]", params: { projectId } })}
            accessibilityRole="button"
            accessibilityLabel="Open project to try again"
            className="mt-4 h-12 items-center justify-center rounded-lg bg-aura-purple active:opacity-80"
          >
            <Text className="text-body-md text-white">Open project</Text>
          </Pressable>
        ) : null}
      </PlanNotice>
    );
  }

  // "Not found" is only trustworthy once the curricula have actually loaded.
  if (!project && (status === "idle" || status === "loading")) {
    return <LoadingState label="learning topics" />;
  }

  if (!project && status === "error") {
    return (
      <ErrorState message={error ?? "Couldn't load your learning topics."} onRetry={refresh} />
    );
  }

  if (!project && !serverProject) {
    return (
      <Text className="text-body-md text-n300">
        We could not find learning topics for this project.
      </Text>
    );
  }

  if (!project || project.topics.length === 0) {
    // A project that just turned ready keeps its empty entry until the
    // learning reload it triggered brings in the new topics.
    if (status === "loading") {
      return <LoadingState label="learning topics" />;
    }
    // Its status is still unknown: it may yet turn out to be generating.
    if (!serverProject && (projectsStatus === "idle" || projectsStatus === "loading")) {
      return <LoadingState label="learning topics" />;
    }
    return <ErrorState message={EMPTY_PLAN_ERROR} onRetry={refresh} />;
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

function PlanNotice({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <Text className="text-h4 text-white">{title}</Text>
      <Text className="mt-1 text-body-sm text-n300">{message}</Text>
      {children}
    </View>
  );
}
