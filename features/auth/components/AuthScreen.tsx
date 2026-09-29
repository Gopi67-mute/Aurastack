import { useSSO } from "@clerk/expo/experimental";
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
import { useEmailAuth } from "../hooks/useEmailAuth";
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
  const { startSSOFlow } = useSSO();

  const [socialError, setSocialError] = useState<string | null>(null);

  const {
    pendingEmail,
    emailError,
    codeError,
    isProcessing,
    submitEmail,
    verifyCode,
    cancelVerification,
  } = useEmailAuth(mode, () => router.replace("/home"));

  async function handleSocialAuth(provider: SocialProvider) {
    setSocialError(null);
    try {
      const { createdSessionId, signUp } = await startSSOFlow({
        strategy: `oauth_${provider}`,
      });

      if (createdSessionId) {
        router.replace("/home");
        return;
      }

      if (signUp?.status === "missing_requirements") {
        setSocialError(
          "We need a bit more info to finish setting up your account. Please continue with email instead."
        );
      }
      // Otherwise the user cancelled the flow — nothing to show.
    } catch {
      setSocialError("Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <KeyboardAvoidingView
        className="flex-1 bg-n900"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        accessibilityElementsHidden={pendingEmail !== null}
        importantForAccessibility={
          pendingEmail !== null ? "no-hide-descendants" : "auto"
        }
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

            <EmailContinueForm
              onSubmitEmail={submitEmail}
              errorMessage={emailError}
            />

            {mode === "sign-up" ? <View nativeID="clerk-captcha" /> : null}

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

            {socialError ? (
              <Text className="mt-3 text-body-sm text-error text-center">
                {socialError}
              </Text>
            ) : null}

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
        onClose={cancelVerification}
        onVerify={verifyCode}
        isVerifying={isProcessing}
        errorMessage={codeError}
      />
    </>
  );
}
