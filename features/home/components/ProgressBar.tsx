import { View } from "react-native";

import { clampProgress } from "../utils/getAuraMessage";

interface ProgressBarProps {
  /** Percentage, 0-100. */
  value: number;
  accessibilityLabel: string;
}

export function ProgressBar({ value, accessibilityLabel }: ProgressBarProps) {
  const percent = clampProgress(value);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="h-2 w-full overflow-hidden rounded-full bg-n600"
    >
      <View
        className="h-full rounded-full bg-aura-purple"
        style={{ width: `${percent}%` }}
      />
    </View>
  );
}
