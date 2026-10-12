/** backend/app/schemas/mentor.py::MAX_MENTOR_MESSAGE_LENGTH. */
export const MAX_MESSAGE_LENGTH = 4000;

/** backend/app/schemas/mentor.py::MAX_MENTOR_HISTORY_TURNS. */
export const MAX_HISTORY_TURNS = 12;

/** backend/app/ai/schemas.py::MAX_MENTOR_REPLY_LENGTH: the longest turn the backend accepts back. */
export const MAX_TURN_LENGTH = 6000;

/**
 * How long the app waits for a reply: the backend's MENTOR_TIMEOUT_SECONDS
 * (30s, backend/app/core/config.py) plus room for the token and network, so
 * a slow model surfaces as the server's own timeout message.
 */
export const MENTOR_REQUEST_TIMEOUT_MS = 45_000;

/**
 * Conversation key for mentoring without a project.
 * backend/app/services/mentor_service.py::mentor_context_key.
 */
export const GENERAL_CONTEXT_KEY = "general";

/** Shown when the selected project is gone or not the signed-in user's (404). */
export const PROJECT_UNAVAILABLE_MESSAGE =
  "That project isn't available anymore. Pick another project or use general mentoring.";
