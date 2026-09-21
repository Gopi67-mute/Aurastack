import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface WorkspaceHeaderProps {
  title?: string;
  onBack: () => void;
}

export function WorkspaceHeader({ title, onBack }: WorkspaceHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 pb-4">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-full border border-n600 bg-n800 active:opacity-80"
      >
        <ChevronLeft size={20} color={colors.neutral.white} />
      </Pressable>
      {title ? (
        <Text
          accessibilityRole="header"
          className="flex-1 text-h3 text-white"
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}
    </View>
  );
}
