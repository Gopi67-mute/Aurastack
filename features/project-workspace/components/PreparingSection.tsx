import { Text, View } from "react-native";

import type { WorkspaceSectionConfig } from "../constants/sections";

interface PreparingSectionProps {
  section: WorkspaceSectionConfig;
}

/** Legitimate empty state until a generated blueprint exists for the project. */
export function PreparingSection({ section }: PreparingSectionProps) {
  const { Icon, label, accent, preparingHint } = section;

  return (
    <View
      accessible
      accessibilityLabel={`${label}. Preparing. ${preparingHint}`}
      className="items-center px-4 py-8"
    >
      <View className={`h-16 w-16 items-center justify-center rounded-xl ${accent.softBg}`}>
        <Icon size={30} color={accent.color} strokeWidth={1.75} />
      </View>
      <Text className="mt-4 text-h4 text-white">Preparing...</Text>
      <Text className="mt-2 text-center text-body-sm text-n300">{preparingHint}</Text>
    </View>
  );
}
