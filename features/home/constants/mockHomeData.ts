import type { HomeData } from "../types/home";

/**
 * V1 placeholder for the Home dashboard payload. Shaped like the future
 * API response so `useHomeData` can swap to a real fetch without touching UI.
 * Projects come from the shared project store; learning and momentum are
 * derived from the Learning data and activity feed.
 */
export function createMockHomeData(): Pick<HomeData, "overallProgress"> {
  return { overallProgress: 72 };
}
