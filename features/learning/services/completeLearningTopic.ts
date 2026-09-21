import { useActivityStore } from "../../../store/useActivityStore";
import { useLearningStore } from "../../../store/useLearningStore";
import type { LearningTopic, ProjectLearning } from "../types/learning";

/**
 * Marks a topic completed (recording `completedAt`) and records a learning
 * activity event, which Momentum lists and the daily streak counts.
 *
 * Side effects: writes the learning and activity stores. Idempotent: a topic
 * that is already completed records nothing, so a repeated press cannot
 * inflate activity.
 */
export function completeLearningTopic(
  project: Pick<ProjectLearning, "projectId" | "projectName">,
  topic: LearningTopic,
): void {
  if (topic.status === "completed") return;

  const now = new Date();
  const completedAt = now.toISOString();
  useLearningStore.getState().setTopicStatus(project.projectId, topic.id, "completed", completedAt);
  useActivityStore.getState().addEvent({
    id: `learning-${project.projectId}-${topic.id}-${now.getTime()}`,
    type: "learning",
    description: `Finished ${topic.title} learning topic`,
    projectId: project.projectId,
    projectName: project.projectName,
    occurredAt: completedAt,
  });
}
