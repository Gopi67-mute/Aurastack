import type { QuickActionKey, QuickActionPrompt } from "../types/mentor";

/**
 * What a quick-action card does. With a project selected, questions the
 * backend can answer from the project's own context are sent straight away;
 * anything that needs details only the user has (a bug, a concept, an
 * architecture the app doesn't know) becomes a starter in the composer.
 */
export function getQuickActionPrompt(key: QuickActionKey, hasProject: boolean): QuickActionPrompt {
  switch (key) {
    case "architecture":
      return hasProject
        ? {
            mode: "send",
            text: "Explain my project's architecture: the main components, how they work together, and why it is structured this way.",
          }
        : {
            mode: "compose",
            text: "Here's my app's architecture: \n\nCan you explain how the parts fit together and what I should improve?",
          };
    case "debug":
      return {
        mode: "compose",
        text: "Help me debug this.\nWhat happens: \nWhat I expected: \nError message or code: ",
      };
    case "next":
      return hasProject
        ? {
            mode: "send",
            text: "Based on my roadmap and learning progress, what should I build next, and why?",
          }
        : {
            mode: "compose",
            text: "What should I build next? My experience so far: ",
          };
    case "concept":
      return { mode: "compose", text: "Explain this concept with a short example: " };
  }
}
