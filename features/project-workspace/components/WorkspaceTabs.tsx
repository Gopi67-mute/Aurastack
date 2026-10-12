import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { WORKSPACE_SECTIONS } from "../constants/sections";
import type { WorkspaceSectionKey } from "../types/workspace";

interface WorkspaceTabsProps {
  active: WorkspaceSectionKey;
  onChange: (key: WorkspaceSectionKey) => void;
}

/**
 * Segmented control for the workspace's internal sections (not global
 * navigation). The selected tab takes its section's accent.
 */
export function WorkspaceTabs({ active, onChange }: WorkspaceTabsProps) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row gap-1 rounded-xl border border-n600 bg-n800 p-1"
    >
      {WORKSPACE_SECTIONS.map(({ key, label, Icon, accent }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            // Keep `active:` on every tab: toggling a pressable state between
            // renders makes react-native-css re-mount the component. The
            // border is always present so selecting a tab never shifts layout.
            className={`min-h-12 flex-1 items-center justify-center gap-1 rounded-lg border px-1 py-2 active:opacity-80 ${
              selected ? `${accent.softBg} ${accent.border}` : "border-transparent"
            }`}
          >
            <Icon size={16} color={selected ? accent.color : colors.neutral.n300} strokeWidth={2} />
            <Text
              className={`text-caption ${selected ? accent.text : "text-n300"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
