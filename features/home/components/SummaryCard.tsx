import { ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface SummaryCardProps {
  icon: LucideIcon;
  iconColor: string;
  /** Tailwind background class for the icon tile, e.g. "bg-aura-purple/15". */
  iconTileClassName: string;
  label: string;
  value: string;
  /** Small unit rendered after the value, e.g. "days". */
  unit?: string;
  caption: string;
  onPress?: () => void;
}

export function SummaryCard({
  icon: Icon,
  iconColor,
  iconTileClassName,
  label,
  value,
  unit,
  caption,
  onPress,
}: SummaryCardProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ""}, ${caption}`}
      className="flex-1 rounded-xl border border-n600 bg-n800 p-3 active:opacity-80"
    >
      <View className="flex-row items-start justify-between">
        <View
          className={`h-10 w-10 items-center justify-center rounded-md ${iconTileClassName}`}
        >
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
        <ChevronRight size={16} color={colors.neutral.n300} strokeWidth={2} />
      </View>

      <Text
        className="mt-3 text-caption uppercase text-n300"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      <Text className="mt-1 text-h3 text-white" numberOfLines={1}>
        {value}
        {unit ? <Text className="text-h4 text-n100"> {unit}</Text> : null}
      </Text>
      <Text
        className="mt-1 text-caption text-n300"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {caption}
      </Text>
    </Pressable>
  );
}
