import { RefreshCw, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import { toErrorMessage } from "../../../lib/remoteData";
import { useProjectStore } from "../../../store/useProjectStore";
import { colors } from "../../../theme/colors";

const RETRY_ERROR = "Couldn't restart generation. Please try again.";

interface GenerationFailedCardProps {
  projectId: string;
}

/**
 * Shown while a project's generation has failed. "Try again" asks the backend
 * to restart it; on success the project returns to "generating" and this card
 * unmounts as the workspace re-renders.
 */
export function GenerationFailedCard({ projectId }: GenerationFailedCardProps) {
  const getToken = useStableGetToken();
  const retryGeneration = useProjectStore((state) => state.retryGeneration);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setError(null);
    try {
      await retryGeneration(projectId, getToken);
    } catch (err) {
      setError(toErrorMessage(err, RETRY_ERROR));
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <View className="flex-row items-center gap-2">
        <TriangleAlert size={20} color={colors.semantic.error} strokeWidth={2} />
        <Text className="text-h4 text-white">Generation failed</Text>
      </View>
      <Text className="mt-1 text-body-sm text-n300">
        We couldn&apos;t generate this project&apos;s learning plan. Your project is saved, so you can
        try again.
      </Text>

      {error ? (
        <Text accessibilityRole="alert" className="mt-3 text-body-sm text-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={retry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Try generating the project again"
        accessibilityState={{ disabled: retrying, busy: retrying }}
        className="mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple active:opacity-80 disabled:opacity-60"
      >
        {retrying ? (
          <ActivityIndicator color={colors.neutral.white} />
        ) : (
          <RefreshCw size={16} color={colors.neutral.white} strokeWidth={2.5} />
        )}
        <Text className="text-body-md text-white">{retrying ? "Retrying..." : "Try again"}</Text>
      </Pressable>
    </View>
  );
}
