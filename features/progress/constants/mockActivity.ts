import type { ActivityEvent, ActivityType } from "../types/progress";

const MORNING_HOUR = 9;
const AFTERNOON_HOUR = 14;

// [daysAgo, hour, type, description]. Today's entry sits at midnight so it is
// never in the future regardless of when the app is opened.
type MockEntry = readonly [number, number, ActivityType, string];

const MOCK_ENTRIES: readonly MockEntry[] = [
  [0, 0, "task", "Completed Authentication task"],
  [1, AFTERNOON_HOUR, "learning", "Finished REST API learning topic"],
  [1, MORNING_HOUR, "task", "Completed Clerk setup task"],
  [2, AFTERNOON_HOUR, "milestone", "Completed API milestone"],
  [2, MORNING_HOUR, "task", "Completed Database schema task"],
  [3, AFTERNOON_HOUR, "task", "Completed MongoDB task"],
  [3, MORNING_HOUR, "task", "Completed API routes task"],
  [4, AFTERNOON_HOUR, "learning", "Finished Expo Router learning topic"],
  [4, 12, "learning", "Finished Pydantic learning topic"],
  [4, 11, "task", "Completed Project card UI task"],
  [4, 10, "task", "Completed Form validation task"],
  [4, MORNING_HOUR, "task", "Completed Navigation task"],
  [5, AFTERNOON_HOUR, "milestone", "Completed Project setup milestone"],
  [5, 11, "task", "Completed FastAPI setup task"],
  [5, MORNING_HOUR, "task", "Completed User model task"],
  [6, AFTERNOON_HOUR, "learning", "Finished React Native basics learning topic"],
  [6, 11, "task", "Completed Expo setup task"],
  [6, MORNING_HOUR, "task", "Completed NativeWind setup task"],
];

/** V1 placeholder for the future activity feed from the user's real projects. */
export function createMockActivity(now: Date = new Date()): ActivityEvent[] {
  return MOCK_ENTRIES.map(([daysAgo, hour, type, description], index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour);
    return {
      id: `mock-activity-${index + 1}`,
      type,
      description,
      occurredAt: date.toISOString(),
    };
  });
}
