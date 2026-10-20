import { act, fireEvent, render, screen } from "@testing-library/react-native";

import Mentor from "../../../app/(tabs)/mentor";
import { ApiError } from "../../../lib/api";
import { resetUserStores } from "../../../store/resetUserStores";
import { useProjectStore } from "../../../store/useProjectStore";
import { getProjects } from "../../projects/services/getProjects";
import type { Project } from "../../projects/types/projects";
import { deleteMentorConversation, getMentorConversation } from "../services/mentorConversation";
import { sendMentorMessage } from "../services/sendMentorMessage";
import type { MentorConversationHistory, MentorReply, MentorStoredMessage } from "../types/mentor";

jest.mock("../../projects/services/getProjects", () => ({ getProjects: jest.fn() }));
jest.mock("../services/sendMentorMessage", () => ({ sendMentorMessage: jest.fn() }));
jest.mock("../services/mentorConversation", () => ({
  getMentorConversation: jest.fn(),
  deleteMentorConversation: jest.fn(),
}));
// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@clerk/expo", () => ({
  useAuth: () => ({ isSignedIn: true, getToken: () => Promise.resolve("token") }),
}));

const mockGetProjects = jest.mocked(getProjects);
const mockSend = jest.mocked(sendMentorMessage);
const mockGetConversation = jest.mocked(getMentorConversation);
const mockDeleteConversation = jest.mocked(deleteMentorConversation);

const storefront: Project = {
  id: "p1",
  name: "Storefront",
  status: "ready",
  progress: 20,
  createdAt: "2026-10-01T00:00:00.000Z",
};

function reply(text: string, projectId: string | null = null): MentorReply {
  return {
    messageId: `reply-${text}`,
    reply: text,
    context: projectId
      ? { projectId, projectName: "Storefront", sources: ["project", "learning"], limitations: ["No blueprint has been generated for this project yet."] }
      : { projectId: null, projectName: null, sources: [], limitations: [] },
  };
}

function saved(...turns: [MentorStoredMessage["role"], string][]): MentorConversationHistory {
  return {
    projectId: null,
    messages: turns.map(([role, content], index) => ({
      id: `saved-${index}`,
      role,
      content,
      context: role === "mentor" ? { projectId: null, projectName: null, sources: [], limitations: [] } : null,
      createdAt: "2026-10-11T00:00:00+00:00",
    })),
  };
}

async function renderMentor() {
  render(<Mentor />);
  // Let the projects load settle.
  await act(async () => {});
}

async function type(text: string) {
  fireEvent.changeText(screen.getByLabelText("Message Aura"), text);
}

async function pressSend() {
  await act(async () => {
    fireEvent.press(screen.getByLabelText("Send message"));
  });
}

beforeEach(() => {
  mockGetProjects.mockReset().mockResolvedValue([storefront]);
  mockSend.mockReset();
  mockGetConversation.mockReset().mockResolvedValue(saved());
  mockDeleteConversation.mockReset().mockResolvedValue(undefined);
  resetUserStores();
});

afterEach(() => resetUserStores());

describe("AI Mentor screen", () => {
  it("shows the header, context selector and welcome state before the first message", async () => {
    await renderMentor();

    expect(screen.getByText("AI Mentor")).toBeTruthy();
    expect(screen.getByText("Your personal AI engineering guide")).toBeTruthy();
    expect(screen.getByLabelText("General")).toBeTruthy();
    expect(screen.getByLabelText("Storefront")).toBeTruthy();
    expect(screen.getByText("Hi, I'm Aura")).toBeTruthy();
    for (const action of ["Explain My Architecture", "Help Me Debug", "What Should I Build Next?", "Explain a Concept"]) {
      expect(screen.getByLabelText(action)).toBeTruthy();
    }
    expect(screen.queryByLabelText("Start a new chat")).toBeNull();
  });

  it("disables sending an empty message", async () => {
    await renderMentor();

    expect(screen.getByLabelText("Send message")).toBeDisabled();
    await type("   ");
    expect(screen.getByLabelText("Send message")).toBeDisabled();
  });

  it("answers a general question and renders the reply with its code block", async () => {
    mockSend.mockResolvedValueOnce(reply("Use a hook:\n```ts\nuseEffect(() => {}, []);\n```"));
    await renderMentor();

    await type("How do I run code on mount?");
    await pressSend();

    expect(mockSend).toHaveBeenCalledWith(
      { messageId: expect.any(String), message: "How do I run code on mount?", projectId: null, history: [] },
      expect.any(Function),
    );
    expect(screen.getByText("How do I run code on mount?")).toBeTruthy();
    expect(screen.getByText("Use a hook:")).toBeTruthy();
    expect(screen.getByText("useEffect(() => {}, []);")).toBeTruthy();
    expect(screen.getByLabelText("Message Aura").props.value).toBe("");
  });

  it("grounds the question in the selected project and shows what it used", async () => {
    mockSend.mockResolvedValueOnce(reply("Your catalog API comes first.", "p1"));
    await renderMentor();

    // Selecting the project loads its own saved conversation.
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Storefront"));
    });
    expect(screen.getByText(/Answers use Storefront's details/)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("What Should I Build Next?"));
    });

    expect(mockSend.mock.calls[0][0]).toMatchObject({ projectId: "p1", history: [] });
    expect(screen.getByText("Your catalog API comes first.")).toBeTruthy();
    expect(screen.getByText("Based on Storefront's project details, learning progress")).toBeTruthy();
    expect(screen.getByText("No blueprint has been generated for this project yet.")).toBeTruthy();
  });

  it("puts starters that need the user's details into the composer", async () => {
    await renderMentor();

    fireEvent.press(screen.getByLabelText("Help Me Debug"));

    expect(mockSend).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Message Aura").props.value).toMatch(/^Help me debug this\./);
  });

  it("shows a thinking state and blocks duplicate sends while waiting", async () => {
    let answer: (value: MentorReply) => void = () => {};
    mockSend.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    await renderMentor();

    await type("Explain closures");
    await pressSend();

    expect(screen.getByLabelText("Aura is thinking")).toBeTruthy();
    await type("Another question");
    expect(screen.getByLabelText("Sending message")).toBeDisabled();
    expect(mockSend).toHaveBeenCalledTimes(1);

    await act(async () => answer(reply("A closure captures variables.")));
    expect(screen.queryByLabelText("Aura is thinking")).toBeNull();
    expect(screen.getByText("A closure captures variables.")).toBeTruthy();
    // The draft typed while waiting is still there.
    expect(screen.getByLabelText("Message Aura").props.value).toBe("Another question");
  });

  it("recovers from a failure with retry, without losing the message", async () => {
    mockSend.mockRejectedValueOnce(new ApiError("Aura took too long to answer. Please try again.", 504));
    await renderMentor();

    await type("Why is my list slow?");
    await pressSend();

    expect(screen.getByText("Aura took too long to answer. Please try again.")).toBeTruthy();
    expect(screen.getByText("Not sent")).toBeTruthy();

    mockSend.mockResolvedValueOnce(reply("Use FlatList."));
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Try again"));
    });

    expect(mockSend.mock.calls[1][0].message).toBe("Why is my list slow?");
    expect(screen.getByText("Use FlatList.")).toBeTruthy();
    expect(screen.queryByText("Not sent")).toBeNull();
  });

  it("returns a failed message to the composer for editing", async () => {
    mockSend.mockRejectedValueOnce(new ApiError("Couldn't reach the server.", 0));
    await renderMentor();

    await type("Draft that failed");
    await pressSend();
    fireEvent.press(screen.getByLabelText("Edit message"));

    expect(screen.getByLabelText("Message Aura").props.value).toBe("Draft that failed");
    expect(screen.getByText("Hi, I'm Aura")).toBeTruthy();
  });

  it("starts a new chat by deleting the saved conversation", async () => {
    mockSend.mockResolvedValueOnce(reply("Hello!"));
    await renderMentor();
    await type("Hi");
    await pressSend();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Start a new chat"));
    });

    expect(mockDeleteConversation).toHaveBeenCalledWith(null, expect.any(Function));
    expect(screen.queryByText("Hello!")).toBeNull();
    expect(screen.getByText("Hi, I'm Aura")).toBeTruthy();
  });

  it("keeps the conversation and explains when a new chat can't be started", async () => {
    mockGetConversation.mockResolvedValueOnce(saved(["user", "Keep me"], ["mentor", "Kept."]));
    mockDeleteConversation.mockRejectedValueOnce(new ApiError("Couldn't start a new chat. Please try again.", 500));
    await renderMentor();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Start a new chat"));
    });

    expect(screen.getByText("Kept.")).toBeTruthy();
    expect(screen.getByText("Couldn't start a new chat. Please try again.")).toBeTruthy();
  });

  it("hides new chat while a reply is pending", async () => {
    mockGetConversation.mockResolvedValueOnce(saved(["user", "Earlier"], ["mentor", "Earlier answer."]));
    mockSend.mockReturnValueOnce(new Promise(() => {}));
    await renderMentor();
    expect(screen.getByLabelText("Start a new chat")).toBeTruthy();

    await type("Still thinking?");
    await pressSend();

    expect(screen.queryByLabelText("Start a new chat")).toBeNull();
  });

  it("keeps general mentoring usable when projects fail to load, and retries them", async () => {
    mockGetProjects.mockReset().mockRejectedValueOnce(new ApiError("Couldn't load your projects.", 500));
    await renderMentor();

    expect(screen.getByLabelText("General")).toBeTruthy();
    mockGetProjects.mockResolvedValueOnce([storefront]);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Couldn't load projects. Try again"));
    });

    expect(screen.getByLabelText("Storefront")).toBeTruthy();
  });

  it("falls back to general mentoring when the selected project disappears", async () => {
    await renderMentor();
    fireEvent.press(screen.getByLabelText("Storefront"));
    expect(screen.getByLabelText("Storefront")).toBeSelected();

    mockGetProjects.mockResolvedValueOnce([]);
    await act(async () => {
      await useProjectStore.getState().load(() => Promise.resolve("token"), true);
    });

    expect(screen.queryByLabelText("Storefront")).toBeNull();
    expect(screen.getByLabelText("General")).toBeSelected();
  });

  describe("saved conversations", () => {
    it("restores the saved conversation in order when opened", async () => {
      mockGetConversation.mockResolvedValueOnce(
        saved(["user", "First question"], ["mentor", "First answer"], ["user", "Second question"], ["mentor", "Second answer"]),
      );
      await renderMentor();

      expect(mockGetConversation).toHaveBeenCalledWith(null, expect.any(Function));
      expect(screen.queryByText("Hi, I'm Aura")).toBeNull();
      // In render order, top to bottom.
      const rendered = screen.getAllByText(/^(First|Second) (question|answer)$/).map(({ props }) => props.children);
      expect(rendered).toEqual(["First question", "First answer", "Second question", "Second answer"]);
    });

    it("shows a loading state and blocks sending until the conversation is loaded", async () => {
      let finish: (value: MentorConversationHistory) => void = () => {};
      mockGetConversation.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
      await renderMentor();

      expect(screen.getByLabelText("Loading conversation")).toBeTruthy();
      await type("Early question");
      expect(screen.getByLabelText("Send message")).toBeDisabled();

      await act(async () => finish(saved()));
      expect(screen.getByText("Hi, I'm Aura")).toBeTruthy();
      expect(screen.getByLabelText("Send message")).toBeEnabled();
    });

    it("shows an error when the conversation can't be loaded, and retries", async () => {
      mockGetConversation.mockRejectedValueOnce(new ApiError("Couldn't load your conversation. Please try again.", 500));
      await renderMentor();

      expect(screen.getByText("Couldn't load your conversation. Please try again.")).toBeTruthy();
      expect(screen.getByLabelText("Send message")).toBeDisabled();

      mockGetConversation.mockResolvedValueOnce(saved(["user", "Recovered"], ["mentor", "Welcome back."]));
      await act(async () => {
        fireEvent.press(screen.getByLabelText("Try again"));
      });

      expect(screen.getByText("Welcome back.")).toBeTruthy();
    });

    it("loads a project's own conversation when it is selected", async () => {
      await renderMentor();
      mockGetConversation.mockResolvedValueOnce(saved(["user", "About Storefront"], ["mentor", "Storefront answer"]));

      await act(async () => {
        fireEvent.press(screen.getByLabelText("Storefront"));
      });

      expect(mockGetConversation).toHaveBeenLastCalledWith("p1", expect.any(Function));
      expect(screen.getByText("Storefront answer")).toBeTruthy();
    });

    it("clears the screen on sign-out and fetches the next account's conversation", async () => {
      mockGetConversation.mockResolvedValueOnce(saved(["user", "A's question"], ["mentor", "A's answer"]));
      await renderMentor();
      expect(screen.getByText("A's answer")).toBeTruthy();

      mockGetConversation.mockResolvedValueOnce(saved(["user", "B's question"], ["mentor", "B's answer"]));
      await act(async () => resetUserStores());

      expect(screen.queryByText("A's answer")).toBeNull();
      expect(screen.getByText("B's answer")).toBeTruthy();
      expect(mockGetConversation).toHaveBeenCalledTimes(2);
    });
  });
});
