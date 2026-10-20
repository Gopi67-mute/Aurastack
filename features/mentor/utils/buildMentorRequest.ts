import { MAX_HISTORY_TURNS, MAX_TURN_LENGTH } from "../constants/mentor";
import type { MentorChatRequest, MentorMessage } from "../types/mentor";

/**
 * The request for user message `message`, given the messages before it in
 * its conversation. Only exchanged ("sent") turns become history: a failed or
 * pending message never got an answer, so it would only confuse the model.
 * History is capped to the most recent turns the backend accepts.
 */
export function buildMentorRequest(
  message: MentorMessage,
  earlier: readonly MentorMessage[],
  projectId: string | null,
): MentorChatRequest {
  const history = earlier
    .filter((turn) => turn.status === "sent")
    .slice(-MAX_HISTORY_TURNS)
    .map(({ role, content }) => ({ role, content: content.slice(0, MAX_TURN_LENGTH) }));

  return { messageId: message.id, message: message.content.trim(), projectId, history };
}
