/** Stable key for a topic's persisted status. */
export function getTopicKey(projectId: string, topicId: string): string {
  return `${projectId}:${topicId}`;
}
