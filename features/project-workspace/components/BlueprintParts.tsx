import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/** Small building blocks shared by the blueprint sections. */

export function Subheading({ title }: { title: string }) {
  return <Text className="text-caption text-n300">{title}</Text>;
}

interface BlockProps {
  title: string;
  children: ReactNode;
}

/** A labelled group of content inside a blueprint section or card. */
export function Block({ title, children }: BlockProps) {
  return (
    <View className="gap-2">
      <Subheading title={title} />
      {children}
    </View>
  );
}

interface BulletListProps {
  items: readonly string[];
  /** Replaces the default dot, e.g. a 14px icon. */
  marker?: ReactNode;
}

export function BulletList({ items, marker }: BulletListProps) {
  return (
    <View className="gap-1">
      {items.map((item, index) => (
        <View key={`${index}-${item}`} className="flex-row gap-2">
          {/* Centres a 14px icon on the first 19px line of body-sm text. */}
          {marker ? <View className="pt-0.5">{marker}</View> : <Text className="text-body-sm text-n300">•</Text>}
          <Text className="flex-1 text-body-sm text-n100">{item}</Text>
        </View>
      ))}
    </View>
  );
}

interface DisclosureProps {
  label: string;
  /** Spoken in place of `label`, e.g. naming what is shown. */
  accessibilityLabel: string;
  expanded: boolean;
  onToggle: () => void;
  /** NativeWind text class of the section accent. */
  accentText: string;
  accentColor: string;
}

/** Shows or hides a card's deeper details. */
export function Disclosure({
  label,
  accessibilityLabel,
  expanded,
  onToggle,
  accentText,
  accentColor,
}: DisclosureProps) {
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded }}
      hitSlop={8}
      className="mt-3 min-h-10 flex-row items-center gap-1 active:opacity-80"
    >
      <Text className={`flex-1 text-body-sm ${accentText}`}>{label}</Text>
      <Chevron size={16} color={accentColor} strokeWidth={2} />
    </Pressable>
  );
}
