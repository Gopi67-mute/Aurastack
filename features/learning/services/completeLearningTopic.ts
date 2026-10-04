import { api, type GetToken } from "../../../lib/api";
import type { LearningTopic } from "../types/learning";

/**
 * Marks a topic completed on the backend, which persists the completion and
 * records the qualifying learning activity the streak is built from.
 *
 * Idempotent server-side: completing an already-completed topic returns its
 * original `completedAt` and cannot add a second qualifying activity, so a
 * repeated press or a retried request never inflates the streak.
 *
 * Returns the backend's updated topic — the authoritative state to store.
 */
export async function completeLearningTopic(
  projectId: string,
  topicId: string,
  getToken: GetToken,
): Promise<LearningTopic> {
  return api.post<LearningTopic>(
    `/api/v1/projects/${projectId}/learning/${topicId}/complete`,
    getToken,
  );
}
