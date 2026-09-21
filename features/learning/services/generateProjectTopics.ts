import type { Project } from "../../projects/types/projects";
import { TOPIC_LIBRARY } from "../constants/topicLibrary";
import type { LearningTopic } from "../types/learning";

/** Lowercase text describing what the project is built with and for. */
function describeProject(project: Project): string {
  return [project.techStack?.join(" "), project.platforms?.join(" "), project.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Temporary stand-in for backend/AI curriculum generation. Builds an ordered,
 * not-started curriculum from the project's own stack, platforms and idea, so
 * every project (including newly created ones) gets its own topics.
 *
 * Pure: same project in, same topics out, which keeps topic ids stable so
 * persisted progress keeps matching. Replace with the API response later.
 */
export function generateProjectTopics(project: Project): LearningTopic[] {
  const haystack = describeProject(project);

  return TOPIC_LIBRARY.filter(
    (entry) => entry.always || entry.keywords.some((keyword) => haystack.includes(keyword)),
  ).map((entry, index) => {
    const content = entry.content(project.name);
    return {
      id: entry.id,
      projectId: project.id,
      title: entry.title,
      description: content.what,
      order: index + 1,
      status: "not_started",
      content,
    };
  });
}
