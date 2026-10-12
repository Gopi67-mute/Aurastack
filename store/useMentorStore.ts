import { create } from "zustand";

import { GENERAL_CONTEXT_KEY } from "../features/mentor/constants/mentor";
import { deleteMentorConversation, getMentorConversation } from "../features/mentor/services/mentorConversation";
import { sendMentorMessage } from "../features/mentor/services/sendMentorMessage";
import type { MentorConversation, MentorMessage, MentorStoredMessage } from "../features/mentor/types/mentor";
import { buildMentorRequest } from "../features/mentor/utils/buildMentorRequest";
import type { GetToken } from "../lib/api";
import { shouldLoad, toErrorMessage } from "../lib/remoteData";

const SEND_ERROR = "Couldn't reach Aura. Check your connection and try again.";
const LOAD_ERROR = "Couldn't load your conversation. Check your connection and try again.";
const CLEAR_ERROR = "Couldn't start a new chat. Check your connection and try again.";

export const EMPTY_CONVERSATION: MentorConversation = {
  messages: [],
  status: "idle",
  isSending: false,
  error: null,
};

/** One conversation per context: general mentoring, or one per project. */
export function mentorContextKey(projectId: string | null): string {
  return projectId ? `project:${projectId}` : GENERAL_CONTEXT_KEY;
}

/**
 * A new user message's id, sent with it and reused when it is retried. Only
 * needs to be unique within one user's conversation.
 */
function newMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function fromStored(message: MentorStoredMessage): MentorMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: "sent",
    context: message.context ?? undefined,
  };
}

interface MentorStoreState {
  /** Null for general mentoring. */
  selectedProjectId: string | null;
  conversations: Readonly<Record<string, MentorConversation>>;
  selectProject: (projectId: string | null) => void;
  /**
   * Fetches the selected context's saved conversation if it hasn't been yet;
   * `force` tries again after a failed fetch. Never rejects: a failure sets
   * the "error" status.
   */
  loadConversation: (getToken: GetToken, force?: boolean) => Promise<void>;
  /**
   * Sends a message in the selected context. Ignored when blank, before the
   * saved conversation has loaded, or while that conversation is still
   * waiting for a reply, so a double tap can never send twice. Never
   * rejects: a failure marks the message "failed".
   */
  send: (content: string, getToken: GetToken) => Promise<void>;
  /** Resends the selected conversation's failed message, if it is the latest. */
  retry: (getToken: GetToken) => Promise<void>;
  /**
   * Removes the selected conversation's failed latest message and returns
   * its text for editing; null when there is none.
   */
  takeFailedMessage: () => string | null;
  /**
   * Deletes the selected context's saved conversation to start over.
   * Ignored while a reply is pending, which the backend would otherwise
   * save into the new chat. Never rejects: a failure keeps the conversation
   * and sets `error`.
   */
  clearConversation: (getToken: GetToken) => Promise<void>;
  /** Forgets every conversation; any response still in flight is dropped. */
  reset: () => void;
}

/**
 * AI Mentor conversations, mirrored from the signed-in user's conversations
 * on the server, which saves each message with its reply.
 *
 * Kept in memory only, never on the device, so one user's questions are
 * never shown to the next user: reset() (via resetUserStores on sign-out)
 * clears everything, and a response that arrives after a reset is
 * discarded. Signing back in fetches the conversations again.
 */
export const useMentorStore = create<MentorStoreState>()((set, get) => {
  /** Bumped by reset(); anything started for the previous user is dropped. */
  let session = 0;

  const update = (key: string, change: (conversation: MentorConversation) => MentorConversation) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [key]: change(state.conversations[key] ?? EMPTY_CONVERSATION),
      },
    }));

  const setStatus = (messages: readonly MentorMessage[], id: string, status: MentorMessage["status"]) =>
    messages.map((message) => (message.id === id ? { ...message, status } : message));

  /** Asks for the reply to the "sending" message `id` of conversation `key`. */
  const request = async (key: string, projectId: string | null, id: string, getToken: GetToken) => {
    const startedIn = session;
    const messages = get().conversations[key]?.messages ?? [];
    const index = messages.findIndex((message) => message.id === id);
    if (index < 0) return;

    // Still current: same user, and the message was not taken back meanwhile.
    const isCurrent = () =>
      session === startedIn &&
      (get().conversations[key]?.messages ?? []).some(
        (message) => message.id === id && message.status === "sending",
      );

    try {
      const reply = await sendMentorMessage(
        buildMentorRequest(messages[index], messages.slice(0, index), projectId),
        getToken,
      );
      if (!isCurrent()) return;
      update(key, (conversation) => ({
        ...conversation,
        isSending: false,
        error: null,
        messages: [
          ...setStatus(conversation.messages, id, "sent"),
          { id: reply.messageId, role: "mentor", content: reply.reply, status: "sent", context: reply.context },
        ],
      }));
    } catch (err) {
      if (!isCurrent()) return;
      update(key, (conversation) => ({
        ...conversation,
        isSending: false,
        error: toErrorMessage(err, SEND_ERROR),
        messages: setStatus(conversation.messages, id, "failed"),
      }));
    }
  };

  const selected = () => {
    const projectId = get().selectedProjectId;
    const key = mentorContextKey(projectId);
    return { projectId, key, conversation: get().conversations[key] ?? EMPTY_CONVERSATION };
  };

  return {
    selectedProjectId: null,
    conversations: {},

    selectProject: (projectId) => set({ selectedProjectId: projectId }),

    loadConversation: async (getToken, force = false) => {
      const { projectId, key, conversation } = selected();
      // A loaded conversation is kept up to date locally; refetching it
      // would drop a failed message the user may still retry.
      if (conversation.status === "ready" || !shouldLoad(conversation.status, force)) return;

      const startedIn = session;
      update(key, (current) => ({ ...current, status: "loading", error: null }));
      try {
        const history = await getMentorConversation(projectId, getToken);
        if (session !== startedIn) return;
        update(key, (current) => ({ ...current, status: "ready", messages: history.messages.map(fromStored) }));
      } catch (err) {
        if (session !== startedIn) return;
        update(key, (current) => ({ ...current, status: "error", error: toErrorMessage(err, LOAD_ERROR) }));
      }
    },

    send: async (content, getToken) => {
      const { projectId, key, conversation } = selected();
      const text = content.trim();
      if (!text || conversation.status !== "ready" || conversation.isSending) return;

      const id = newMessageId();
      update(key, (current) => ({
        ...current,
        isSending: true,
        error: null,
        messages: [...current.messages, { id, role: "user", content: text, status: "sending" }],
      }));
      await request(key, projectId, id, getToken);
    },

    retry: async (getToken) => {
      const { projectId, key, conversation } = selected();
      const last = conversation.messages.at(-1);
      if (conversation.status !== "ready" || conversation.isSending || last?.status !== "failed") return;

      update(key, (current) => ({
        ...current,
        isSending: true,
        error: null,
        messages: setStatus(current.messages, last.id, "sending"),
      }));
      await request(key, projectId, last.id, getToken);
    },

    takeFailedMessage: () => {
      const { key, conversation } = selected();
      const last = conversation.messages.at(-1);
      if (conversation.isSending || last?.status !== "failed") return null;

      update(key, (current) => ({
        ...current,
        error: null,
        messages: current.messages.slice(0, -1),
      }));
      return last.content;
    },

    clearConversation: async (getToken) => {
      const { projectId, key, conversation } = selected();
      if (conversation.status !== "ready" || conversation.isSending) return;

      const startedIn = session;
      update(key, (current) => ({ ...current, status: "loading", error: null }));
      try {
        await deleteMentorConversation(projectId, getToken);
        if (session !== startedIn) return;
        update(key, () => ({ ...EMPTY_CONVERSATION, status: "ready" }));
      } catch (err) {
        if (session !== startedIn) return;
        update(key, (current) => ({ ...current, status: "ready", error: toErrorMessage(err, CLEAR_ERROR) }));
      }
    },

    reset: () => {
      session += 1;
      set({ selectedProjectId: null, conversations: {} });
    },
  };
});
