import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { PLATFORM_OPTIONS } from "../constants/platforms";
import type { ProjectPlatform } from "../types/createProject";

interface PlatformSelectorProps {
  value: ProjectPlatform[];
  onChange: (next: ProjectPlatform[]) => void;
  hasError?: boolean;
}

// Multi-select platform tiles (a set of toggles, not a radio group).
export function PlatformSelector({ value, onChange, hasError }: PlatformSelectorProps) {
  const toggle = (platform: ProjectPlatform) => {
    onChange(
      value.includes(platform)
        ? value.filter((selected) => selected !== platform)
        : [...value, platform]
    );
  };

  return (
    <View className="flex-row gap-3">
      {PLATFORM_OPTIONS.map(({ value: platform, label, Icon }) => {
        const selected = value.includes(platform);
        const borderClass = selected
          ? "border-aura-purple bg-n600"
          : hasError
            ? "border-error bg-n800"
            : "border-n600 bg-n800";

        return (
          <Pressable
            key={platform}
            onPress={() => toggle(platform)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={label}
            className={`min-h-24 flex-1 justify-between rounded-lg border p-3 active:opacity-80 ${borderClass}`}
          >
            <View className="flex-row items-start justify-between">
              <Icon
                size={28}
                color={selected ? colors.brand.auraPurple : colors.neutral.n300}
              />
              {selected ? (
                <View className="h-6 w-6 items-center justify-center rounded-full bg-aura-purple">
                  <Check size={14} color={colors.neutral.white} strokeWidth={3} />
                </View>
              ) : (
                <View className="h-6 w-6 rounded-full border border-n300" />
              )}
            </View>
            <Text className="text-h4 text-white">{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
