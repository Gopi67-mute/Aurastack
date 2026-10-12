import { ArrowUp } from "lucide-react-native";
import type { Ref } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { colors } from "../../../theme/colors";
import { MAX_MESSAGE_LENGTH } from "../constants/mentor";

/** Five lines of body text before the input scrolls instead of growing. */
const MAX_INPUT_HEIGHT = 120;

interface MentorComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** A reply is pending: sending again is blocked until it settles. */
  isSending: boolean;
  /** Sending is blocked, e.g. until the saved conversation has loaded. */
  disabled?: boolean;
  inputRef?: Ref<TextInput>;
}

export function MentorComposer({
  value,
  onChangeText,
  onSend,
  isSending,
  disabled = false,
  inputRef,
}: MentorComposerProps) {
  const canSend = value.trim().length > 0 && !isSending && !disabled;

  return (
    <View className="flex-row items-end gap-2 border-t border-n700 bg-n900 px-4 py-3">
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask Aura anything…"
        placeholderTextColor={colors.neutral.n300}
        accessibilityLabel="Message Aura"
        multiline
        maxLength={MAX_MESSAGE_LENGTH}
        textAlignVertical="center"
        style={{ maxHeight: MAX_INPUT_HEIGHT }}
        className="min-h-12 flex-1 rounded-xl border border-n600 bg-n800 px-4 py-3 text-body-md text-white"
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={isSending ? "Sending message" : "Send message"}
        accessibilityState={{ disabled: !canSend, busy: isSending }}
        className={`h-12 w-12 items-center justify-center rounded-full ${
          canSend ? "bg-aura-purple active:opacity-80" : "bg-n700"
        }`}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={colors.neutral.white} />
        ) : (
          <ArrowUp size={20} color={canSend ? colors.neutral.white : colors.neutral.n300} strokeWidth={2.5} />
        )}
      </Pressable>
    </View>
  );
}
