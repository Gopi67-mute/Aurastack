import type { RefObject } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { VERIFICATION_CODE_LENGTH } from "../constants/copy";

type VerificationCodeInputProps = {
  code: string;
  onChangeText: (text: string) => void;
  inputRef: RefObject<TextInput | null>;
};

export function VerificationCodeInput({
  code,
  onChangeText,
  inputRef,
}: VerificationCodeInputProps) {
  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      className="w-full flex-row justify-between"
      accessibilityRole="none"
    >
      {Array.from({ length: VERIFICATION_CODE_LENGTH }).map((_, index) => {
        const digit = code[index];
        const isActive = index === code.length;

        return (
          <View
            key={index}
            className={`w-12 h-14 rounded-xl items-center justify-center border bg-n800 ${
              isActive ? "border-aura-purple" : "border-n700"
            }`}
          >
            <Text className="text-h2 text-white">{digit ?? ""}</Text>
          </View>
        );
      })}

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={VERIFICATION_CODE_LENGTH}
        autoFocus
        caretHidden
        className="absolute inset-0 opacity-0"
        accessibilityLabel="Verification code"
      />
    </Pressable>
  );
}
