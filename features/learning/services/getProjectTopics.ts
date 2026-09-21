import type { Project } from "../../projects/types/projects";
import { getMockCurriculum } from "../constants/mockLearning";
import type { LearningTopic } from "../types/learning";
import { generateProjectTopics } from "./generateProjectTopics";

/**
 * The topic catalog for one project, in learning order, before the user's
 * progress is applied. Single seam for the future learning API: swap the body
 * for the backend response and nothing else changes.
 */
export function getProjectTopics(project: Project): LearningTopic[] {
  return getMockCurriculum(project.id) ?? generateProjectTopics(project);
}
