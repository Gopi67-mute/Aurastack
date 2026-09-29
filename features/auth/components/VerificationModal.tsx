import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  BackHandler,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VERIFICATION_CODE_LENGTH } from "../constants/copy";
import { useVerificationCode } from "../hooks/useVerificationCode";
import { VerificationCodeInput } from "./VerificationCodeInput";

type VerificationModalProps = {
  visible: boolean;
  email: string;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  isVerifying?: boolean;
  errorMessage?: string | null;
};

export function VerificationModal({
  visible,
  email,
  onClose,
  onVerify,
  isVerifying,
  errorMessage,
}: VerificationModalProps) {
  const insets = useSafeAreaInsets();
  const { code, inputRef, handleChangeText, focus, reset } =
    useVerificationCode(onVerify);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      focus();
    } else {
      reset();
    }
  }, [visible, focus, reset]);

  // KeyboardAvoidingView derives its offset from this view's `onLayout` frame,
  // which is measured relative to its immediate parent, not the screen. That
  // math silently resolves to 0 here because the sheet is a conditionally
  // mounted `position: absolute` overlay (see note below), so `behavior="height"`
  // never actually shrinks it and the OTP row stays behind the keyboard.
  // Tracking the keyboard height directly and applying it as bottom padding
  // sidesteps that frame math entirely and is reliable on Android.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const showEvent =
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow";
    const hideEvent =
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [visible]);

  // Android hardware back button must dismiss the sheet, matching the
  // behavior `Modal`'s onRequestClose used to provide.
  useEffect(() => {
    if (!visible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );

    return () => subscription.remove();
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  // React Native's `Modal` renders in its own native Android window. With
  // `android.edgeToEdgeEnabled` on (app.json), keyboard/IME insets are only
  // delivered to the app's main window, so KeyboardAvoidingView never learns
  // the keyboard opened while this sheet lived inside a Modal. Rendering the
  // sheet as a plain overlay in the normal screen tree keeps it in that same
  // window, where the keyboard height listeners above work correctly.
  return (
    <View className="absolute inset-0" accessibilityViewIsModal>
      <Pressable
        className="absolute inset-0 bg-black/60"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss verification"
      />

      <View className="flex-1 justify-end">
        <View
          className="w-full rounded-t-2xl border-t border-n700 bg-n900 px-6 pt-6"
          style={{
            paddingBottom: Math.max(insets.bottom, 24) + keyboardHeight,
          }}
        >
          <View>
            <View className="flex-row items-center justify-between">
              <Text className="text-h3 text-white">Check your email</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={22} color="#9CA3AF" />
              </Pressable>
            </View>

            <Pressable onPress={Keyboard.dismiss} accessibilityRole="none">
              <Text className="mt-2 text-body-md text-n300">
                We sent a {VERIFICATION_CODE_LENGTH}-digit verification code to{" "}
                <Text className="text-n100">{email}</Text>. Enter it below to
                continue.
              </Text>
            </Pressable>
          </View>

          <View className="mt-8">
            <VerificationCodeInput
              code={code}
              onChangeText={handleChangeText}
              inputRef={inputRef}
            />
          </View>

          {isVerifying ? (
            <Text className="mt-3 text-body-sm text-n300 text-center">
              Verifying...
            </Text>
          ) : errorMessage ? (
            <Text className="mt-3 text-body-sm text-error text-center">
              {errorMessage}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
