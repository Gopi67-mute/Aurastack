import { useMemo } from "react";

import { useActivityStore } from "../../../store/useActivityStore";
import { createMockActivity } from "../constants/mockActivity";
import type { ActivityEvent } from "../types/progress";

/**
 * The full activity feed: mock history plus activity the user recorded.
 * Single source for Progress, Momentum and the streak.
 */
export function useActivityEvents(): readonly ActivityEvent[] {
  const recorded = useActivityStore((state) => state.events);
  return useMemo(() => [...createMockActivity(), ...recorded], [recorded]);
}
