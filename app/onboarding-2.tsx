import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BookOpen, Box, Layers, Network } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeatureCard } from "../components/onboarding/FeatureCard";

const TOTAL_STEPS = 3;

type Onboarding2Props = {
  activeStep?: number;
};

const FEATURES = [
  {
    icon: Layers,
    title: "Tech Stack",
    description: "Best technologies for your project.",
    accentColor: "#7C3AED",
    accentBgClassName: "bg-aura-purple/15",
  },
  {
    icon: Box,
    title: "Architecture",
    description: "Scalable structure that fits your idea.",
    accentColor: "#7C3AED",
    accentBgClassName: "bg-aura-purple/15",
  },
  {
    icon: Network,
    title: "Roadmap",
    description: "Step-by-step plan to build it right.",
    accentColor: "#00D1FF",
    accentBgClassName: "bg-aura-blue/15",
  },
  {
    icon: BookOpen,
    title: "Learning",
    description: "Skills and resources to level up.",
    accentColor: "#00D1FF",
    accentBgClassName: "bg-aura-blue/15",
  },
] as const;

export default function Onboarding2({ activeStep = 1 }: Onboarding2Props) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View className="flex-1 bg-n900">
        <ScrollView
          className="flex-1"
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View className="items-center mt-32">
            <View className="w-16 h-16 rounded-lg bg-aura-purple items-center justify-center">
              <Text className="text-h2 text-white">2</Text>
            </View>

            <View className="mt-6 items-center flex-row flex-wrap justify-center">
              <Text className="text-h1 text-white text-center">Plan → </Text>
              <Text className="text-h1 text-aura-blue text-center">build</Text>
            </View>

            <Text className="mt-4 text-body-lg text-n300 text-center px-2">
              Get the stack, architecture, roadmap, and skills you need.
            </Text>
          </View>

          <View className="w-full items-center gap-4 mt-10 mb-6">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </View>

          <View className="flex-row items-center gap-2 mt-6 mb-16">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
              <View
                key={index}
                className={
                  index === activeStep
                    ? "w-6 h-2 rounded-full bg-aura-purple"
                    : "w-2 h-2 rounded-full bg-n300"
                }
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </>
  );
}
