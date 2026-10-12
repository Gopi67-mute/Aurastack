import { SquarePen } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface MentorHeaderProps {
  /** Shown once the selected context has a conversation to start over. */
  onNewChat?: () => void;
}

export function MentorHeader({ onNewChat }: MentorHeaderProps) {
  return (
    <View className="flex-row items-start justify-between gap-4 px-4">
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-h1 text-white">
          AI Mentor
        </Text>
        <Text className="mt-1 text-body-md text-n300">Your personal AI engineering guide</Text>
      </View>
      {onNewChat ? (
        <Pressable
          onPress={onNewChat}
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          hitSlop={8}
          className="mt-1 h-11 w-11 items-center justify-center rounded-full border border-n600 bg-n800 active:opacity-80"
        >
          <SquarePen size={18} color={colors.neutral.white} />
        </Pressable>
      ) : null}
    </View>
  );
}
