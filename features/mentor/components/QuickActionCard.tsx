import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface QuickActionCardProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  onPress: () => void;
  disabled: boolean;
}

export function QuickActionCard({ title, description, Icon, onPress, disabled }: QuickActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      className={`min-h-28 flex-1 basis-[46%] rounded-xl border border-n600 bg-n800 p-4 active:opacity-80 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-aura-purple/20">
        <Icon size={18} color={colors.semantic.aiAccent} />
      </View>
      <Text className="mt-3 text-h4 text-white">{title}</Text>
      <Text className="mt-1 text-caption text-n300">{description}</Text>
    </Pressable>
  );
}
