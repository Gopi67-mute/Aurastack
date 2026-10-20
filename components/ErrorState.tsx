import { RefreshCw } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../theme/colors";

interface ErrorStateProps {
  /**
   * User-facing message. Comes from the API layer or the backend's response
   * envelope, so it never contains internal details.
   */
  message: string;
  onRetry?: () => void;
}

/** Shared error state for screens whose backend read failed. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <Text className="text-h4 text-white">Something went wrong</Text>
      <Text className="mt-1 text-body-sm text-n300">{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple active:opacity-80"
        >
          <RefreshCw size={16} color={colors.neutral.white} strokeWidth={2.5} />
          <Text className="text-body-md text-white">Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
