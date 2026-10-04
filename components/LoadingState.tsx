import { ActivityIndicator, Text, View } from "react-native";

import { colors } from "../theme/colors";

interface LoadingStateProps {
  /** What is loading, e.g. "projects". Used for the screen-reader label too. */
  label: string;
}

/** Shared loading state for screens waiting on a backend read. */
export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View
      accessible
      accessibilityLabel={`Loading ${label}`}
      className="items-center justify-center rounded-xl border border-n600 bg-n800 px-6 py-8"
    >
      <ActivityIndicator color={colors.brand.auraPurple} />
      <Text className="mt-3 text-body-md text-n300">Loading {label}...</Text>
    </View>
  );
}
