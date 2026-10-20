import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";

import TabsLayout from "../../app/(tabs)/_layout";

interface MockScreenProps {
  name: string;
  options: {
    title?: string;
    tabBarHideOnKeyboard?: boolean;
    tabBarButton?: (props: object) => ReactElement;
  };
}

const mockScreens: MockScreenProps[] = [];
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const Tabs = ({ children }: { children: unknown }) => children;
  Tabs.Screen = (props: MockScreenProps) => {
    mockScreens.push(props);
    return null;
  };
  return { Tabs, useRouter: () => ({ push: mockPush }) };
});
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockScreens.length = 0;
  mockPush.mockReset();
});

describe("bottom tabs", () => {
  it("places AI Mentor immediately after the central create button", () => {
    render(<TabsLayout />);

    expect(mockScreens.map(({ name }) => name)).toEqual(["home", "projects", "create", "mentor", "profile"]);
    const mentor = mockScreens[3];
    expect(mentor.options.title).toBe("AI Mentor");
    // Keeps the tab bar from covering the composer while typing.
    expect(mentor.options.tabBarHideOnKeyboard).toBe(true);
  });

  it("keeps the central button opening project creation", () => {
    render(<TabsLayout />);
    const button = mockScreens.find(({ name }) => name === "create")?.options.tabBarButton;
    expect(button).toBeDefined();

    render(button!({}));
    fireEvent.press(screen.getByLabelText("Create a new project"));

    expect(mockPush).toHaveBeenCalledWith("/create-project");
  });
});
