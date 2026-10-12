import type { RemoteStatus } from "../../../lib/remoteData";

export type MentorRole = "user" | "mentor";

/** What a reply was grounded in, besides the conversation itself. */
export type MentorContextSource = "project" | "blueprint" | "learning";

/** Mirrors backend/app/schemas/mentor.py::MentorContextInfo. */
export interface MentorContextInfo {
  projectId: string | null;
  projectName: string | null;
  sources: readonly MentorContextSource[];
  /** User-facing notes on project context that was unavailable. */
  limitations: readonly string[];
}

/** Mirrors backend/app/schemas/mentor.py::MentorReply. */
export interface MentorReply {
  /** The saved reply's id. */
  messageId: string;
  reply: string;
  context: MentorContextInfo;
}

export interface MentorTurn {
  role: MentorRole;
  content: string;
}

/** Mirrors backend/app/schemas/mentor.py::MentorChatRequest. */
export interface MentorChatRequest {
  /**
   * The user message's id. Reused when the message is retried, so the
   * backend returns the saved reply instead of saving the exchange twice.
   */
  messageId: string;
  message: string;
  /** Null for general mentoring. */
  projectId: string | null;
  /** Earlier sent turns, oldest first. */
  history: readonly MentorTurn[];
}

/** Mirrors backend/app/schemas/mentor.py::MentorMessageOut. */
export interface MentorStoredMessage {
  id: string;
  role: MentorRole;
  content: string;
  /** Set on mentor messages. */
  context: MentorContextInfo | null;
  createdAt: string;
}

/** Mirrors backend/app/schemas/mentor.py::MentorConversationOut. */
export interface MentorConversationHistory {
  projectId: string | null;
  /** Oldest first; empty when nothing has been saved yet. */
  messages: readonly MentorStoredMessage[];
}

/**
 * "sending": a user message awaiting its reply. "failed": a user message
 * whose reply never arrived; it can be retried or edited. Mentor messages
 * are always "sent".
 */
export type MentorMessageStatus = "sending" | "sent" | "failed";

export interface MentorMessage {
  id: string;
  role: MentorRole;
  content: string;
  status: MentorMessageStatus;
  /** Set on mentor messages. */
  context?: MentorContextInfo;
}

export interface MentorConversation {
  messages: readonly MentorMessage[];
  /**
   * The saved conversation: "loading" while it is fetched or deleted for a
   * new chat; "error" when it couldn't be fetched. Sending waits for "ready".
   */
  status: RemoteStatus;
  isSending: boolean;
  /**
   * User-facing message: why the saved conversation couldn't be loaded
   * ("error" status), or why the latest send or new chat failed.
   */
  error: string | null;
}

export type QuickActionKey = "architecture" | "debug" | "next" | "concept";

/**
 * "send" submits `text` straight away; "compose" puts it in the composer for
 * the user to finish (it needs details only they have).
 */
export interface QuickActionPrompt {
  mode: "send" | "compose";
  text: string;
}
