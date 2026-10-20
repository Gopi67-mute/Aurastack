interface AuraMessageTier {
  /** Inclusive upper bound of the progress range this message covers. */
  maxProgress: number;
  message: string;
}

// Ordered ascending. Project/development-context messages only.
const AURA_MESSAGE_TIERS: readonly AuraMessageTier[] = [
  { maxProgress: 0, message: "Let's build your first step. 🚀" },
  { maxProgress: 24, message: "You're getting started. Keep building! 🔥" },
  { maxProgress: 49, message: "Nice progress. Keep the momentum going! 💪" },
  { maxProgress: 69, message: "You're halfway there. Keep pushing! 🚀" },
  { maxProgress: 89, message: "You're doing great! Keep going. ⚡" },
  { maxProgress: 99, message: "Almost there. Finish strong! 🎯" },
  { maxProgress: 100, message: "You did it! Project complete. 🎉" },
];

/** Clamps to 0-100 and rounds; non-finite values count as 0. */
export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/** Maps an overall progress percentage to Aura's contextual message. */
export function getAuraMessage(progress: number): string {
  const value = clampProgress(progress);
  const tier = AURA_MESSAGE_TIERS.find((t) => value <= t.maxProgress);
  return (tier ?? AURA_MESSAGE_TIERS[AURA_MESSAGE_TIERS.length - 1]).message;
}
