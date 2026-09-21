/**
 * Centralized image imports (AGENTS.md Image Rules).
 * Add new static image assets here instead of `require`-ing them directly
 * inside components.
 */
export const images = {
  authMascot: require("../assets/images/aura -oauth.png"),
  auraBotThumbsUp: require("../assets/images/thumps-up.png"),
  auraBotWave: require("../assets/images/empty-state.png"),
} as const;
