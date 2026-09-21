import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { images } from "../../../constants/images";

interface RecentProjectsEmptyProps {
  onCreatePress: () => void;
}

export function RecentProjectsEmpty({ onCreatePress }: RecentProjectsEmptyProps) {
  return (
    <View className="items-center rounded-xl border border-n600 bg-n800 px-6 py-8">
      <Image
        source={images.auraBotWave}
        style={{ width: 120, height: 120 }}
        contentFit="contain"
        accessibilityLabel="AuraBot waving"
      />
      <Text className="mt-4 text-h3 text-white text-center">No projects yet</Text>
      <Text className="mt-2 text-body-md text-n300 text-center">
        Turn an idea into a structured plan with Aura AI.
      </Text>
      <Pressable
        onPress={onCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create your first project"
        className="mt-6 min-h-12 items-center justify-center rounded-lg bg-aura-purple px-6 active:opacity-80"
      >
        <Text className="text-h4 text-white">Create your first project</Text>
      </Pressable>
    </View>
  );
}
