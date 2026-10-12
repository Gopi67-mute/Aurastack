import { fireEvent, render, screen } from "@testing-library/react-native";

import Home from "../../../app/(tabs)/home";
import type { HomeData } from "../types/home";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockRouter = { navigate: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("@clerk/expo", () => ({ useUser: () => ({ user: { firstName: "Ada", imageUrl: null } }) }));

const mockHomeData: HomeData = {
  overallProgress: 0,
  projects: { total: 0, active: 0 },
  learning: { completedTopics: 0, totalTopics: 0 },
  momentum: { streakDays: 0, topicsThisWeek: 0 },
  recentProjects: [],
};
jest.mock("../hooks/useHomeData", () => ({
  useHomeData: () => ({ data: mockHomeData, status: "ready", error: null, refresh: jest.fn() }),
}));

describe("Home profile avatar", () => {
  it("opens the existing Profile tab instead of pushing a second profile screen", () => {
    render(<Home />);

    fireEvent.press(screen.getByRole("button", { name: "Open your profile" }));

    expect(mockRouter.navigate).toHaveBeenCalledWith("/profile");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
