import { Image } from "expo-image";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Onboarding2 from "./onboarding-2";
import Onboarding3 from "./onboarding-3";

const TOTAL_STEPS = 3;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeStep, setActiveStep] = useState(0);

  function handleMomentumScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    const nextStep = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveStep(nextStep);
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <View className="flex-1 bg-n900">
        <ScrollView
          className="flex-1"
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          <View style={{ width }}>
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
              <Image
                source={require("../assets/images/aurastack-logo.png")}
                style={{
                  width: "72%",
                  maxWidth: 260,
                  aspectRatio: 1.5,
                  marginTop: Math.max(insets.top, 16),
                }}
                contentFit="contain"
              />

              <View className="items-center mt-8">
                <View className="w-16 h-16 rounded-lg bg-aura-purple items-center justify-center">
                  <Text className="text-h2 text-white">1</Text>
                </View>

                <View className="mt-6 items-center">
                  <Text className="text-h1 text-white text-center">
                    Your idea →
                  </Text>
                  <Text className="text-h1 text-aura-purple text-center">
                    structured project
                  </Text>
                </View>

                <Text className="mt-4 text-body-lg text-n300 text-center px-2">
                  Turn your idea into a real development plan.
                </Text>
              </View>

              <Image
                source={require("../assets/images/onboarding1-vis.png")}
                style={{
                  width: "88%",
                  maxWidth: 420,
                  aspectRatio: 1.5,
                  marginTop: 8,
                }}
                contentFit="contain"
              />

              <View className="flex-row items-center gap-2 mt-16 mb-16">
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

          <View style={{ width }}>
            <Onboarding2 activeStep={activeStep} />
          </View>

          <View style={{ width }}>
            <Onboarding3 activeStep={activeStep} />
          </View>
        </ScrollView>
      </View>
    </>
  );
}
