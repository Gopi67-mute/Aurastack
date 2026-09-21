import { Image } from "expo-image";
import { Target } from "lucide-react-native";
import { Text, View } from "react-native";

import { images } from "../../../constants/images";
import { colors } from "../../../theme/colors";
import { clampProgress, getAuraMessage } from "../utils/getAuraMessage";
import { ProgressBar } from "./ProgressBar";

interface OverallProgressCardProps {
  progress: number;
}

export function OverallProgressCard({ progress }: OverallProgressCardProps) {
  const percent = clampProgress(progress);

  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Target size={18} color={colors.brand.auraPurple} strokeWidth={2} />
            <Text className="text-h4 text-n100">Overall Progress</Text>
          </View>
          <Text className="mt-2 text-h1 text-white">{percent}%</Text>

          <View className="mt-2 self-start rounded-lg border border-n600 bg-n700 px-3 py-2">
            <Text className="text-body-sm text-n100">
              <Text className="text-aura-blue">Aura AI · </Text>
              {getAuraMessage(percent)}
            </Text>
          </View>
        </View>

        <Image
          source={images.auraBotThumbsUp}
          style={{ width: 128, height: 128 }}
          contentFit="contain"
          accessibilityLabel="AuraBot giving a thumbs up"
        />
      </View>

      <View className="mt-4">
        <ProgressBar value={percent} accessibilityLabel="Overall progress" />
      </View>
    </View>
  );
}
