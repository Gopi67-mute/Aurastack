import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthScreen } from "../features/auth/components/AuthScreen";

export default function SignIn() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <AuthScreen mode="sign-in" />
    </>
  );
}
