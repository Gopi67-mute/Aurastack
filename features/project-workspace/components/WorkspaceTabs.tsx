import { Pressable, Text, View } from "react-native";

import { WORKSPACE_SECTIONS } from "../constants/sections";
import type { WorkspaceSectionKey } from "../types/workspace";

interface WorkspaceTabsProps {
  active: WorkspaceSectionKey;
  onChange: (key: WorkspaceSectionKey) => void;
}

/** Segmented control for the workspace's internal sections (not global navigation). */
export function WorkspaceTabs({ active, onChange }: WorkspaceTabsProps) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row gap-1 rounded-xl border border-n600 bg-n800 p-1"
    >
      {WORKSPACE_SECTIONS.map(({ key, label }) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            // Keep `active:` on every tab: toggling a pressable state between
            // renders makes react-native-css re-mount the component.
            className={`min-h-10 flex-1 items-center justify-center rounded-lg px-1 active:opacity-80 ${
              selected ? "bg-aura-purple" : ""
            }`}
          >
            <Text
              className={`text-caption ${selected ? "text-white" : "text-n300"}`}
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
