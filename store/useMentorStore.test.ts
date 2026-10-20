import { deleteMentorConversation, getMentorConversation } from "../features/mentor/services/mentorConversation";
import { sendMentorMessage } from "../features/mentor/services/sendMentorMessage";
import type { MentorConversationHistory, MentorReply, MentorStoredMessage } from "../features/mentor/types/mentor";
import { ApiError } from "../lib/api";
import { resetUserStores } from "./resetUserStores";
import { EMPTY_CONVERSATION, mentorContextKey, useMentorStore } from "./useMentorStore";

jest.mock("../features/mentor/services/sendMentorMessage", () => ({ sendMentorMessage: jest.fn() }));
jest.mock("../features/mentor/services/mentorConversation", () => ({
  getMentorConversation: jest.fn(),
  deleteMentorConversation: jest.fn(),
}));

const mockSend = jest.mocked(sendMentorMessage);
const mockGet = jest.mocked(getMentorConversation);
const mockDelete = jest.mocked(deleteMentorConversation);
const getToken = () => Promise.resolve("token");

let replyCount = 0;
function reply(text: string, projectId: string | null = null): MentorReply {
  replyCount += 1;
  return {
    messageId: `reply-${replyCount}`,
    reply: text,
    context: { projectId, projectName: projectId, sources: projectId ? ["project"] : [], limitations: [] },
  };
}

function stored(id: string, role: MentorStoredMessage["role"], content: string): MentorStoredMessage {
  return {
    id,
    role,
    content,
    context: role === "mentor" ? { projectId: null, projectName: null, sources: [], limitations: [] } : null,
    createdAt: "2026-10-11T00:00:00+00:00",
  };
}

function history(...messages: MentorStoredMessage[]): MentorConversationHistory {
  return { projectId: null, messages };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const conversation = (projectId: string | null = null) =>
  useMentorStore.getState().conversations[mentorContextKey(projectId)] ?? EMPTY_CONVERSATION;
const contents = (projectId: string | null = null) =>
  conversation(projectId).messages.map(({ role, content, status }) => [role, content, status]);

/** Selects a context and loads its saved conversation, as opening it on screen does. */
async function open(projectId: string | null = null) {
  useMentorStore.getState().selectProject(projectId);
  await useMentorStore.getState().loadConversation(getToken);
}

beforeEach(() => {
  mockSend.mockReset();
  mockGet.mockReset().mockResolvedValue(history());
  mockDelete.mockReset().mockResolvedValue(undefined);
  useMentorStore.getState().reset();
});

describe("useMentorStore: saved conversations", () => {
  it("restores the saved conversation in order, with each reply's context", async () => {
    mockGet.mockResolvedValueOnce(
      history(
        stored("u1", "user", "First?"),
        stored("r1", "mentor", "First answer."),
        stored("u2", "user", "Second?"),
        stored("r2", "mentor", "Second answer."),
      ),
    );

    await open();

    expect(mockGet).toHaveBeenCalledWith(null, getToken);
    expect(conversation().status).toBe("ready");
    expect(conversation().messages.map(({ id }) => id)).toEqual(["u1", "r1", "u2", "r2"]);
    expect(contents()).toEqual([
      ["user", "First?", "sent"],
      ["mentor", "First answer.", "sent"],
      ["user", "Second?", "sent"],
      ["mentor", "Second answer.", "sent"],
    ]);
    expect(conversation().messages[0].context).toBeUndefined();
    expect(conversation().messages[1].context?.sources).toEqual([]);
  });

  it("starts empty when nothing has been saved", async () => {
    await open();

    expect(conversation()).toEqual({ ...EMPTY_CONVERSATION, status: "ready" });
  });

  it("fetches a context once, and each context separately", async () => {
    await open();
    await open();
    await open("p1");

    expect(mockGet.mock.calls.map(([projectId]) => projectId)).toEqual([null, "p1"]);
  });

  it("restores everything sent before an app reload", async () => {
    await open();
    mockSend.mockResolvedValueOnce(reply("Saved answer."));
    await useMentorStore.getState().send("Saved question", getToken);
    const [request] = mockSend.mock.calls[0];

    // A reload loses all in-memory state; the server returns what it saved.
    useMentorStore.getState().reset();
    mockGet.mockResolvedValueOnce(
      history(stored(request.messageId, "user", "Saved question"), stored("reply-1", "mentor", "Saved answer.")),
    );
    await open();

    expect(contents()).toEqual([
      ["user", "Saved question", "sent"],
      ["mentor", "Saved answer.", "sent"],
    ]);
  });

  it("waits for the saved conversation before sending", async () => {
    const pending = deferred<MentorConversationHistory>();
    mockGet.mockReturnValueOnce(pending.promise);
    useMentorStore.getState().selectProject(null);
    const loading = useMentorStore.getState().loadConversation(getToken);

    await useMentorStore.getState().send("Too early", getToken);
    expect(conversation().status).toBe("loading");

    pending.resolve(history(stored("u1", "user", "Earlier"), stored("r1", "mentor", "Earlier answer.")));
    await loading;

    expect(mockSend).not.toHaveBeenCalled();
    expect(contents()).toHaveLength(2);
  });

  it("shows a load failure and tries again on request", async () => {
    mockGet.mockRejectedValueOnce(new ApiError("Couldn't load your conversation. Please try again.", 500));
    await open();

    expect(conversation()).toMatchObject({ status: "error", error: "Couldn't load your conversation. Please try again." });
    await useMentorStore.getState().loadConversation(getToken);
    expect(mockGet).toHaveBeenCalledTimes(1);

    mockGet.mockResolvedValueOnce(history(stored("u1", "user", "Back"), stored("r1", "mentor", "Hi again.")));
    await useMentorStore.getState().loadConversation(getToken, true);

    expect(conversation()).toMatchObject({ status: "ready", error: null });
    expect(contents()).toHaveLength(2);
  });

  it("uses a safe fallback when loading fails unexpectedly", async () => {
    mockGet.mockRejectedValueOnce(new TypeError("internal stack detail"));
    await open();

    expect(conversation().error).toBe("Couldn't load your conversation. Check your connection and try again.");
  });

  it("only shows the signed-in user's conversations, and drops a late load after sign-out", async () => {
    mockGet.mockResolvedValueOnce(history(stored("a1", "user", "A's question"), stored("a2", "mentor", "A's answer")));
    await open();

    const late = deferred<MentorConversationHistory>();
    mockGet.mockReturnValueOnce(late.promise);
    useMentorStore.getState().selectProject("a-project");
    const lateLoad = useMentorStore.getState().loadConversation(getToken);

    resetUserStores();
    expect(useMentorStore.getState()).toMatchObject({ selectedProjectId: null, conversations: {} });
    late.resolve(history(stored("a3", "user", "A's project question")));
    await lateLoad;
    expect(useMentorStore.getState().conversations).toEqual({});

    // User B signs in: a fresh fetch, which the backend scopes to B.
    mockGet.mockResolvedValueOnce(history(stored("b1", "user", "B's question")));
    await open();
    expect(contents()).toEqual([["user", "B's question", "sent"]]);
  });
});

describe("useMentorStore: sending", () => {
  beforeEach(() => open());

  it("sends a general message with a new id and appends the saved reply", async () => {
    const answer = reply("Use dependency injection.");
    mockSend.mockResolvedValueOnce(answer);

    await useMentorStore.getState().send("  What is DI?  ", getToken);

    const [request] = mockSend.mock.calls[0];
    expect(request).toEqual({ messageId: expect.any(String), message: "What is DI?", projectId: null, history: [] });
    // The backend's MentorMessageId pattern.
    expect(request.messageId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(conversation().messages.map(({ id }) => id)).toEqual([request.messageId, answer.messageId]);
    expect(contents()).toEqual([
      ["user", "What is DI?", "sent"],
      ["mentor", "Use dependency injection.", "sent"],
    ]);
    expect(conversation().isSending).toBe(false);
  });

  it("gives every new message its own id", async () => {
    mockSend.mockResolvedValue(reply("ok"));

    await useMentorStore.getState().send("One", getToken);
    await useMentorStore.getState().send("Two", getToken);

    expect(mockSend.mock.calls[0][0].messageId).not.toBe(mockSend.mock.calls[1][0].messageId);
  });

  it("sends the selected project and earlier turns, restored ones included, as history", async () => {
    mockGet.mockResolvedValueOnce(history(stored("u0", "user", "Zero"), stored("r0", "mentor", "Restored.")));
    mockSend.mockResolvedValueOnce(reply("First.", "p1")).mockResolvedValueOnce(reply("Second.", "p1"));
    await open("p1");

    await useMentorStore.getState().send("One", getToken);
    await useMentorStore.getState().send("Two", getToken);

    expect(mockSend.mock.calls[1][0]).toMatchObject({
      message: "Two",
      projectId: "p1",
      history: [
        { role: "user", content: "Zero" },
        { role: "mentor", content: "Restored." },
        { role: "user", content: "One" },
        { role: "mentor", content: "First." },
      ],
    });
    expect(conversation("p1").messages.at(-1)?.context?.projectId).toBe("p1");
  });

  it("ignores blank messages and a second send while a reply is pending", async () => {
    const pending = deferred<MentorReply>();
    mockSend.mockReturnValueOnce(pending.promise);

    const first = useMentorStore.getState().send("Hello", getToken);
    await useMentorStore.getState().send("Hello", getToken);
    await useMentorStore.getState().send("   ", getToken);
    expect(conversation().isSending).toBe(true);

    pending.resolve(reply("Hi!"));
    await first;

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(contents()).toHaveLength(2);
  });

  it("keeps a failed message, then retries it with the same id without duplicating it", async () => {
    mockSend.mockRejectedValueOnce(new ApiError("Your message couldn't be saved. Please try again.", 500));

    await useMentorStore.getState().send("Help", getToken);

    expect(contents()).toEqual([["user", "Help", "failed"]]);
    expect(conversation().error).toBe("Your message couldn't be saved. Please try again.");

    mockSend.mockResolvedValueOnce(reply("Here's how."));
    await useMentorStore.getState().retry(getToken);

    const [first, second] = mockSend.mock.calls.map(([request]) => request);
    // Same id: the backend returns the saved reply if the first try was saved.
    expect(second).toEqual(first);
    expect(contents()).toEqual([
      ["user", "Help", "sent"],
      ["mentor", "Here's how.", "sent"],
    ]);
    expect(conversation().error).toBeNull();
  });

  it("uses a safe fallback for non-API failures and leaves failed turns out of history", async () => {
    mockSend.mockRejectedValueOnce(new TypeError("internal stack detail"));
    await useMentorStore.getState().send("First", getToken);
    expect(conversation().error).toBe("Couldn't reach Aura. Check your connection and try again.");

    mockSend.mockResolvedValueOnce(reply("Ok."));
    await useMentorStore.getState().send("Second", getToken);

    expect(mockSend.mock.calls[1][0].history).toEqual([]);
  });

  it("hands back a failed message for editing", async () => {
    mockSend.mockRejectedValueOnce(new ApiError("offline", 0));
    await useMentorStore.getState().send("Draft text", getToken);

    expect(useMentorStore.getState().takeFailedMessage()).toBe("Draft text");
    expect(conversation()).toEqual({ ...EMPTY_CONVERSATION, status: "ready" });
    expect(useMentorStore.getState().takeFailedMessage()).toBeNull();
  });

  it("keeps each context's conversation separate", async () => {
    mockSend.mockResolvedValue(reply("ok"));
    await useMentorStore.getState().send("general question", getToken);
    await open("p1");
    await useMentorStore.getState().send("project question", getToken);

    expect(contents(null)[0][1]).toBe("general question");
    expect(contents("p1")[0][1]).toBe("project question");
    expect(mockSend.mock.calls[1][0].history).toEqual([]);
  });

  it("forgets user A's conversations on sign-out and drops their late replies", async () => {
    mockSend.mockResolvedValueOnce(reply("A's answer", "a-project"));
    await open("a-project");
    await useMentorStore.getState().send("A's question", getToken);

    const pending = deferred<MentorReply>();
    mockSend.mockReturnValueOnce(pending.promise);
    const lateSend = useMentorStore.getState().send("A's second question", getToken);

    resetUserStores();
    pending.resolve(reply("A's late answer", "a-project"));
    await lateSend;

    expect(useMentorStore.getState()).toMatchObject({ selectedProjectId: null, conversations: {} });
  });
});

describe("useMentorStore: new chat", () => {
  beforeEach(async () => {
    mockGet.mockResolvedValueOnce(history(stored("u1", "user", "Old"), stored("r1", "mentor", "Old answer.")));
    await open();
  });

  it("deletes the saved conversation, then starts empty", async () => {
    await useMentorStore.getState().clearConversation(getToken);

    expect(mockDelete).toHaveBeenCalledWith(null, getToken);
    expect(conversation()).toEqual({ ...EMPTY_CONVERSATION, status: "ready" });
  });

  it("keeps the conversation and says so when the delete fails", async () => {
    mockDelete.mockRejectedValueOnce(new ApiError("Couldn't start a new chat. Please try again.", 500));

    await useMentorStore.getState().clearConversation(getToken);

    expect(contents()).toHaveLength(2);
    expect(conversation()).toMatchObject({ status: "ready", error: "Couldn't start a new chat. Please try again." });
  });

  it("won't start a new chat while a reply is pending, which would be saved into it", async () => {
    const pending = deferred<MentorReply>();
    mockSend.mockReturnValueOnce(pending.promise);
    const sending = useMentorStore.getState().send("Hello", getToken);

    await useMentorStore.getState().clearConversation(getToken);
    pending.resolve(reply("Hi!"));
    await sending;

    expect(mockDelete).not.toHaveBeenCalled();
    expect(contents()).toHaveLength(4);
  });
});
