import { FolderX } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

interface ProjectNotFoundProps {
  onBackToProjects: () => void;
}

export function ProjectNotFound({ onBackToProjects }: ProjectNotFoundProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <FolderX size={48} color={colors.brand.auraPurple} strokeWidth={1.5} />
      <Text className="mt-4 text-h3 text-white">Project not found</Text>
      <Text className="mt-2 text-center text-body-md text-n300">
        The project you&apos;re looking for may have been removed or is no longer available.
      </Text>
      <Pressable
        onPress={onBackToProjects}
        accessibilityRole="button"
        accessibilityLabel="Back to Projects"
        className="mt-6 min-h-12 w-full items-center justify-center rounded-lg bg-aura-purple px-6 active:opacity-80"
      >
        <Text className="text-h4 text-white">Back to Projects</Text>
      </Pressable>
    </View>
  );
}
