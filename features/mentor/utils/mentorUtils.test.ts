import { api, ApiError } from "../../../lib/api";
import { MAX_HISTORY_TURNS, MAX_TURN_LENGTH, MENTOR_REQUEST_TIMEOUT_MS } from "../constants/mentor";
import { deleteMentorConversation, getMentorConversation } from "../services/mentorConversation";
import { sendMentorMessage } from "../services/sendMentorMessage";
import type { MentorMessage } from "../types/mentor";
import { buildMentorRequest } from "./buildMentorRequest";
import { getQuickActionPrompt } from "./getQuickActionPrompt";
import { splitCodeBlocks } from "./splitCodeBlocks";

const message = (id: number, status: MentorMessage["status"] = "sent", content = `m${id}`): MentorMessage => ({
  id: `m${id}`,
  role: id % 2 ? "user" : "mentor",
  content,
  status,
});

describe("buildMentorRequest", () => {
  it("builds a general request with no project", () => {
    expect(buildMentorRequest(message(1, "sending", "  hi  "), [], null)).toEqual({
      messageId: "m1",
      message: "hi",
      projectId: null,
      history: [],
    });
  });

  it("keeps only exchanged turns, the most recent ones, within the backend's limits", () => {
    const earlier = [
      message(1, "failed"),
      ...Array.from({ length: MAX_HISTORY_TURNS + 2 }, (_, index) => message(index + 2)),
      message(99, "sending"),
    ];
    earlier[earlier.length - 2] = message(50, "sent", "x".repeat(MAX_TURN_LENGTH + 10));

    const request = buildMentorRequest(message(101, "sending", "next"), earlier, "p1");

    expect(request.projectId).toBe("p1");
    expect(request.history).toHaveLength(MAX_HISTORY_TURNS);
    expect(request.history.some(({ content }) => content === "m1" || content === "m99")).toBe(false);
    expect(request.history.at(-1)?.content).toHaveLength(MAX_TURN_LENGTH);
  });
});

describe("splitCodeBlocks", () => {
  it("separates prose from fenced code and keeps code indentation", () => {
    const text = "Try this:\n```ts\nconst a = 1;\n  if (a) run();\n```\nThen test it.";

    expect(splitCodeBlocks(text)).toEqual([
      { kind: "text", content: "Try this:" },
      { kind: "code", language: "ts", content: "const a = 1;\n  if (a) run();" },
      { kind: "text", content: "Then test it." },
    ]);
  });

  it("treats an unclosed fence as code to the end and drops empty segments", () => {
    expect(splitCodeBlocks("```\nnpm test")).toEqual([{ kind: "code", language: null, content: "npm test" }]);
    expect(splitCodeBlocks("Plain answer.")).toEqual([{ kind: "text", content: "Plain answer." }]);
  });
});

describe("getQuickActionPrompt", () => {
  it("sends project questions the backend can answer from context", () => {
    expect(getQuickActionPrompt("architecture", true).mode).toBe("send");
    expect(getQuickActionPrompt("next", true).mode).toBe("send");
  });

  it("asks for details only the user has", () => {
    expect(getQuickActionPrompt("architecture", false).mode).toBe("compose");
    expect(getQuickActionPrompt("next", false).mode).toBe("compose");
    expect(getQuickActionPrompt("debug", true).mode).toBe("compose");
    expect(getQuickActionPrompt("concept", true).mode).toBe("compose");
  });
});

describe("sendMentorMessage", () => {
  const getToken = () => Promise.resolve("token");
  const request = { messageId: "msg-00000001", message: "hi", projectId: null, history: [] };

  afterEach(() => jest.restoreAllMocks());

  it("posts to the mentor endpoint with the longer timeout", async () => {
    const post = jest.spyOn(api, "post").mockResolvedValueOnce({ reply: "ok", context: {} });

    await sendMentorMessage(request, getToken);

    expect(post).toHaveBeenCalledWith("/api/v1/mentor/chat", getToken, request, {
      timeoutMs: MENTOR_REQUEST_TIMEOUT_MS,
    });
  });

  it.each([
    [404, "That project isn't available anymore. Pick another project or use general mentoring."],
    [422, "That message couldn't be sent. Restart the app to update it, then try again."],
    [500, "Your message couldn't be saved. Please try again."],
    [502, "Aura couldn't produce a valid answer. Please try again."],
    [503, "Aura is unavailable right now. Please try again."],
    [504, "Aura took too long to answer. Please try again."],
  ])("maps HTTP %i to friendly copy", async (status, text) => {
    jest.spyOn(api, "post").mockRejectedValueOnce(new ApiError(`Request failed with status ${status}`, status));

    await expect(sendMentorMessage(request, getToken)).rejects.toEqual(new ApiError(text, status));
  });

  it("passes network failures through unchanged", async () => {
    const offline = new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
    jest.spyOn(api, "post").mockRejectedValueOnce(offline);

    await expect(sendMentorMessage(request, getToken)).rejects.toBe(offline);
  });
});

describe("mentor conversation services", () => {
  const getToken = () => Promise.resolve("token");

  afterEach(() => jest.restoreAllMocks());

  it("reads and deletes the general or a project's conversation", async () => {
    const get = jest.spyOn(api, "get").mockResolvedValue({ projectId: null, messages: [] });
    const remove = jest.spyOn(api, "delete").mockResolvedValue(null);

    await getMentorConversation(null, getToken);
    await getMentorConversation("p 1/x", getToken);
    await deleteMentorConversation("p1", getToken);

    expect(get.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/mentor/conversation",
      "/api/v1/mentor/conversation?projectId=p%201%2Fx",
    ]);
    expect(remove).toHaveBeenCalledWith("/api/v1/mentor/conversation?projectId=p1", getToken);
  });

  it("maps storage and ownership failures to friendly copy", async () => {
    jest.spyOn(api, "get").mockRejectedValueOnce(new ApiError("Request failed with status 500", 500));
    jest.spyOn(api, "delete").mockRejectedValueOnce(new ApiError("Request failed with status 404", 404));

    await expect(getMentorConversation(null, getToken)).rejects.toEqual(
      new ApiError("Couldn't load your conversation. Please try again.", 500),
    );
    await expect(deleteMentorConversation("p1", getToken)).rejects.toEqual(
      new ApiError("That project isn't available anymore. Pick another project or use general mentoring.", 404),
    );
  });
});
