import { api, type GetToken } from "../../../lib/api";
import { PROJECT_UNAVAILABLE_MESSAGE } from "../constants/mentor";
import type { MentorConversationHistory } from "../types/mentor";
import { withStatusMessages } from "../utils/withStatusMessages";

/** The signed-in user's conversation for general mentoring or one project. */
function conversationPath(projectId: string | null): string {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return `/api/v1/mentor/conversation${query}`;
}

/**
 * The signed-in user's saved conversation for this context, oldest first;
 * empty when nothing has been saved yet. The backend only ever reads the
 * caller's own conversations.
 *
 * Rejects with an `ApiError` whose message is safe to show.
 */
export async function getMentorConversation(
  projectId: string | null,
  getToken: GetToken,
): Promise<MentorConversationHistory> {
  return withStatusMessages(api.get<MentorConversationHistory>(conversationPath(projectId), getToken), {
    404: PROJECT_UNAVAILABLE_MESSAGE,
    500: "Couldn't load your conversation. Please try again.",
  });
}

/**
 * Deletes the signed-in user's saved conversation for this context, to start
 * a new chat. Succeeds when there is none.
 *
 * Rejects with an `ApiError` whose message is safe to show.
 */
export async function deleteMentorConversation(projectId: string | null, getToken: GetToken): Promise<void> {
  await withStatusMessages(api.delete<null>(conversationPath(projectId), getToken), {
    404: PROJECT_UNAVAILABLE_MESSAGE,
    500: "Couldn't start a new chat. Please try again.",
  });
}
