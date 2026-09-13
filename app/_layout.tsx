import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";

import { useAppBootstrap } from "../hooks/useAppBootstrap";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { status, error, retry } = useAppBootstrap();

  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hideAsync();
    }
  }, [status]);

  // Render a view matching the native splash background instead of `null`.
  // On Android, the system splash (SplashScreen API, API 31+) auto-dismisses
  // on first frame draw regardless of `preventAutoHideAsync()`, so an empty
  // root view here briefly exposes the black window background beneath it.
  if (status === "loading") {
    return <View className="flex-1 bg-n800" />;
  }

  if (status === "error") {
    return (
      <View className="flex-1 items-center justify-center bg-n800 px-8">
        <Text className="text-h3 text-white text-center mb-4">
          Something went wrong starting AuraStack
        </Text>
        <Text className="text-body-md text-n300 text-center mb-8">
          {error}
        </Text>
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Retry startup"
          className="bg-aura-purple px-6 py-3 rounded-lg"
        >
          <Text className="text-body-md text-white">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return <Stack />;
}
