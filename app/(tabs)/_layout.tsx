import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Tabs, useRouter } from "expo-router";
import { Home, LayoutGrid, Plus, Sparkles, User } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../../theme/colors";

const ACTIVE_COLOR = colors.brand.auraPurple;
const INACTIVE_COLOR = colors.neutral.n300;

// Renders the "Create" tab as an elevated circular action instead of a
// standard icon+label item, per AGENTS: it must read as the primary action.
// Opens the full-screen Create Project flow instead of switching tabs.
function CreateTabButton(_props: BottomTabBarButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/create-project")}
      accessibilityRole="button"
      accessibilityLabel="Create a new project"
      className="flex-1 items-center justify-center"
    >
      <View
        className="w-14 h-14 rounded-full items-center justify-center bg-aura-purple"
        style={{
          top: -10,
          shadowColor: colors.brand.auraPurple,
          shadowOpacity: 0.45,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Plus size={28} color={colors.neutral.white} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: colors.neutral.n800,
          borderTopColor: colors.neutral.n700,
          borderTopWidth: 1,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 2,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter-Medium",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "",
          tabBarAccessibilityLabel: "Create a new project",
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="mentor"
        options={{
          title: "AI Mentor",
          // The composer sits at the bottom: keep the tab bar from riding up
          // with the keyboard and covering it (notably on Android).
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => (
            <Sparkles color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
