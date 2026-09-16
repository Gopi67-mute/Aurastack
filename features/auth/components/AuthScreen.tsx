import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { images } from "../../../constants/images";
import { AUTH_COPY } from "../constants/copy";
import type { AuthMode, SocialProvider } from "../types/auth";
import { AuthDivider } from "./AuthDivider";
import { AuthHeader } from "./AuthHeader";
import { EmailContinueForm } from "./EmailContinueForm";
import { SocialAuthButton } from "./SocialAuthButton";
import { VerificationModal } from "./VerificationModal";

type AuthScreenProps = {
  mode: AuthMode;
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const copy = AUTH_COPY[mode];

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Social OAuth and email delivery aren't wired to a provider yet (Clerk
  // isn't installed) — this is UI-only until that integration lands.
  function handleSocialAuth(_provider: SocialProvider) {}

  function handleVerified() {
    setPendingEmail(null);
    router.replace("/home");
  }

  return (
    <>
      <KeyboardAvoidingView
        className="flex-1 bg-n900"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
          <Pressable className="flex-1" onPress={Keyboard.dismiss}>
            <AuthHeader title={copy.title} subtitle={copy.subtitle} />

            <View className="flex-1 items-center justify-center">
              <Image
                source={images.authMascot}
                style={{ width: "80%", maxWidth: 340, aspectRatio: 1 }}
                contentFit="contain"
              />
            </View>

            <EmailContinueForm onSubmitEmail={setPendingEmail} />

            <View className="my-6">
              <AuthDivider />
            </View>

            <View className="w-full gap-3">
              <SocialAuthButton
                provider="google"
                onPress={() => handleSocialAuth("google")}
              />
              <SocialAuthButton
                provider="facebook"
                onPress={() => handleSocialAuth("facebook")}
              />
              <SocialAuthButton
                provider="x"
                onPress={() => handleSocialAuth("x")}
              />
            </View>

            <View className="mt-6 flex-row items-center justify-center gap-1">
              <Text className="text-body-md text-n300">
                {copy.footerPrompt}
              </Text>
              <Text
                className="text-body-md text-aura-purple"
                accessibilityRole="link"
                onPress={() => router.replace(copy.footerActionHref)}
              >
                {copy.footerActionLabel}
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <VerificationModal
        visible={pendingEmail !== null}
        email={pendingEmail ?? ""}
        onClose={() => setPendingEmail(null)}
        onVerified={handleVerified}
      />
    </>
  );
}
