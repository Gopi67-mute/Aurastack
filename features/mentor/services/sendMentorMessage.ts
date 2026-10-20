import { api, type GetToken } from "../../../lib/api";
import { MENTOR_REQUEST_TIMEOUT_MS, PROJECT_UNAVAILABLE_MESSAGE } from "../constants/mentor";
import type { MentorChatRequest, MentorReply } from "../types/mentor";
import { withStatusMessages } from "../utils/withStatusMessages";

/** Friendly copy for the statuses the mentor endpoint can return. */
const STATUS_MESSAGES: Record<number, string> = {
  404: PROJECT_UNAVAILABLE_MESSAGE,
  // The composer already enforces the length limit, so a rejected request
  // means this app is out of date with the server, not that the user erred.
  422: "That message couldn't be sent. Restart the app to update it, then try again.",
  // Nothing is saved on any failure, so the message can safely be retried.
  500: "Your message couldn't be saved. Please try again.",
  502: "Aura couldn't produce a valid answer. Please try again.",
  503: "Aura is unavailable right now. Please try again.",
  504: "Aura took too long to answer. Please try again.",
};

/**
 * Asks the backend's AI mentor for a reply. The backend checks that
 * `projectId` belongs to the signed-in user, and saves the message and reply
 * to that user's conversation before answering; the model and its keys
 * never leave the server.
 *
 * Rejects with an `ApiError` whose message is safe to show.
 */
export async function sendMentorMessage(
  request: MentorChatRequest,
  getToken: GetToken,
): Promise<MentorReply> {
  return withStatusMessages(
    api.post<MentorReply>("/api/v1/mentor/chat", getToken, request, {
      timeoutMs: MENTOR_REQUEST_TIMEOUT_MS,
    }),
    STATUS_MESSAGES,
  );
}
