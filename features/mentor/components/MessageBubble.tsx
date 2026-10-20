import { memo, useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import type { MentorContextSource, MentorMessage } from "../types/mentor";
import { splitCodeBlocks } from "../utils/splitCodeBlocks";

const SOURCE_LABELS: Record<MentorContextSource, string> = {
  project: "project details",
  blueprint: "blueprint",
  learning: "learning progress",
};

function MentorContent({ content }: { content: string }) {
  const segments = useMemo(() => splitCodeBlocks(content), [content]);

  return (
    <View className="gap-3">
      {segments.map((segment, index) =>
        segment.kind === "code" ? (
          <View key={index} className="rounded-md border border-n600 bg-n900">
            {segment.language ? (
              <Text className="px-3 pt-2 text-caption text-n300">{segment.language}</Text>
            ) : null}
            {/* Code keeps its lines: long ones scroll sideways instead of wrapping. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text selectable style={styles.code} className="p-3 text-n100">
                {segment.content}
              </Text>
            </ScrollView>
          </View>
        ) : (
          <Text key={index} selectable className="text-body-md text-n100">
            {segment.content}
          </Text>
        ),
      )}
    </View>
  );
}

function MessageBubbleComponent({ message }: { message: MentorMessage }) {
  if (message.role === "user") {
    const failed = message.status === "failed";
    return (
      <View className="items-end">
        <View
          className={`max-w-[85%] rounded-xl rounded-br-sm px-4 py-3 ${
            failed ? "border border-error/60 bg-n800" : "bg-aura-purple"
          }`}
        >
          <Text selectable className="text-body-md text-white">
            {message.content}
          </Text>
        </View>
        {failed ? <Text className="mt-1 text-caption text-error">Not sent</Text> : null}
      </View>
    );
  }

  const sources = message.context?.sources ?? [];
  const limitations = message.context?.limitations ?? [];
  return (
    <View
      accessible
      accessibilityLabel={`Aura says: ${message.content}`}
      className="rounded-xl rounded-bl-sm border border-n600 bg-n800 px-4 py-3"
    >
      <Text className="mb-2 text-caption text-ai-accent">Aura</Text>
      <MentorContent content={message.content} />
      {sources.length > 0 ? (
        <Text className="mt-3 text-caption text-n300">
          Based on {message.context?.projectName}&apos;s{" "}
          {sources.map((source) => SOURCE_LABELS[source]).join(", ")}
        </Text>
      ) : null}
      {limitations.map((limitation) => (
        <Text key={limitation} className="mt-1 text-caption text-n300">
          {limitation}
        </Text>
      ))}
    </View>
  );
}

/** One chat message. Memoised: a long thread re-renders only what changed. */
export const MessageBubble = memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  // Platform-specific: the app's Inter has no monospace face.
  code: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 13,
    lineHeight: 19,
  },
});
