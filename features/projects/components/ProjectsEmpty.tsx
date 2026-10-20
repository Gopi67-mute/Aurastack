import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { images } from "../../../constants/images";
import { colors } from "../../../theme/colors";

interface ProjectsEmptyProps {
  onCreatePress: () => void;
}

export function ProjectsEmpty({ onCreatePress }: ProjectsEmptyProps) {
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
        Turn your next idea into a structured project.
      </Text>
      <Pressable
        onPress={onCreatePress}
        accessibilityRole="button"
        accessibilityLabel="Create project"
        className="mt-6 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple px-6 active:opacity-80"
      >
        <Plus size={18} color={colors.neutral.white} strokeWidth={2.5} />
        <Text className="text-h4 text-white">Create Project</Text>
      </Pressable>
    </View>
  );
}
