import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, Sparkles } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { setOnboardingCompleted } from "../lib/onboardingStorage";

const TOTAL_STEPS = 3;

type Onboarding3Props = {
  activeStep?: number;
  onGetStarted?: () => void;
};

export default function Onboarding3({
  activeStep = 2,
  onGetStarted,
}: Onboarding3Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  async function handleGetStarted() {
    await setOnboardingCompleted();

    if (onGetStarted) {
      onGetStarted();
      return;
    }
    router.push("/sign-up");
  }

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
          <View className="items-center mt-16">
            <View className="w-16 h-16 rounded-lg bg-aura-purple items-center justify-center">
              <Text className="text-h2 text-white">3</Text>
            </View>

            <View className="mt-6 items-center flex-row flex-wrap justify-center">
              <Text className="text-h1 text-white text-center">Build • </Text>
              <Text className="text-h1 text-aura-purple text-center">grow</Text>
            </View>

            <Text className="mt-4 text-body-lg text-n300 text-center px-2">
              Your AI project mentor stays with you throughout development.
            </Text>
          </View>

          <Image
            source={require("../assets/images/3rd-screen.png")}
            style={{
              width: "96%",
              maxWidth: 460,
              aspectRatio: 1,
              marginTop: 4,
            }}
            contentFit="contain"
          />

          <View className="w-full flex-row items-center gap-4 rounded-xl border border-n700 bg-n800 p-4 mt-1">
            <View className="w-12 h-12 rounded-md items-center justify-center bg-aura-purple/15">
              <Sparkles size={24} color="#7C3AED" strokeWidth={1.75} />
            </View>

            <View className="flex-1">
              <Text className="text-body-md text-n100">
                Aura AI is here to guide you, answer, and help you ship your
                ideas.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2 mt-6 mb-4">
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

          <Pressable
            onPress={handleGetStarted}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
            className="w-full flex-row items-center justify-center gap-2 rounded-xl bg-aura-purple py-4"
          >
            <Text className="text-h4 text-white">Get Started</Text>
            <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}
