import { useRef } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/ErrorState";
import { colors } from "../../../theme/colors";
import type { MentorConversation, MentorMessage } from "../types/mentor";
import { MessageBubble } from "./MessageBubble";

interface MentorThreadProps {
  conversation: MentorConversation;
  onRetry: () => void;
  onEditFailed: () => void;
}

function ThreadFooter({ conversation, onRetry, onEditFailed }: MentorThreadProps) {
  if (conversation.isSending) {
    return (
      <View
        accessible
        accessibilityLabel="Aura is thinking"
        accessibilityLiveRegion="polite"
        className="flex-row items-center gap-2 self-start rounded-xl border border-n600 bg-n800 px-4 py-3"
      >
        <ActivityIndicator size="small" color={colors.brand.auraPurple} />
        <Text className="text-body-sm text-n300">Aura is thinking…</Text>
      </View>
    );
  }

  if (!conversation.error) return null;
  const failed = conversation.messages.at(-1)?.status === "failed";
  if (!failed) {
    // E.g. a new chat that couldn't be started: the conversation is unchanged.
    return (
      <View accessibilityLiveRegion="polite">
        <ErrorState message={conversation.error} />
      </View>
    );
  }
  return (
    <View accessibilityLiveRegion="polite">
      <ErrorState message={conversation.error} onRetry={onRetry} />
      <Pressable
        onPress={onEditFailed}
        accessibilityRole="button"
        accessibilityLabel="Edit message"
        className="mt-2 min-h-11 items-center justify-center rounded-lg border border-n600 active:opacity-80"
      >
        <Text className="text-body-md text-n100">Edit message</Text>
      </Pressable>
    </View>
  );
}

/** The selected context's messages, oldest first, kept scrolled to the latest. */
export function MentorThread(props: MentorThreadProps) {
  const listRef = useRef<FlatList<MentorMessage>>(null);

  return (
    <FlatList
      ref={listRef}
      data={props.conversation.messages}
      keyExtractor={(message) => message.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      ListFooterComponent={<ThreadFooter {...props} />}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 12 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      showsVerticalScrollIndicator={false}
    />
  );
}
