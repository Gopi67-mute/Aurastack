import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface FormFieldProps {
  label: string;
  Icon: LucideIcon;
  hint?: string;
  error?: string;
  children: ReactNode;
}

// Labeled form section: icon + required label, control, then error or hint.
export function FormField({ label, Icon, hint, error, children }: FormFieldProps) {
  return (
    <View>
      <View className="mb-2 flex-row items-center gap-2">
        <Icon size={20} color={colors.brand.auraPurple} />
        <Text className="text-h4 text-white">
          {label} <Text className="text-ai-accent">*</Text>
        </Text>
      </View>
      {children}
      {error ? (
        <Text
          className="mt-2 text-body-sm text-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-2 text-body-sm text-n300">{hint}</Text>
      ) : null}
    </View>
  );
}
