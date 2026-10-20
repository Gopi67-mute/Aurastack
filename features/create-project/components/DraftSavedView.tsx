import { CircleCheck } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { PLATFORM_LABELS } from "../constants/platforms";
import type { ProjectDraft } from "../types/createProject";

interface DraftSavedViewProps {
  draft: ProjectDraft;
  onCreateAnother: () => void;
  onDone: () => void;
}

// Shown once the backend has created the project. Its learning plan is still
// being generated in the background; the project's status tracks that.
export function DraftSavedView({ draft, onCreateAnother, onDone }: DraftSavedViewProps) {
  return (
    <View className="flex-1 justify-between">
      <View className="items-center pt-8">
        <CircleCheck size={56} color={colors.semantic.success} />
        <Text className="mt-4 text-h2 text-white text-center">Project created</Text>
        <Text className="mt-2 text-body-md text-n300 text-center">
          We&apos;re generating your learning plan. You can follow its progress in Projects.
        </Text>

        <View className="mt-8 w-full gap-3 rounded-xl border border-n600 bg-n800 p-4">
          <Text className="text-h4 text-white">{draft.title}</Text>
          <Text className="text-body-md text-n300">{draft.description}</Text>
          <Text className="text-body-sm text-ai-accent">
            {draft.platforms.map((platform) => PLATFORM_LABELS[platform]).join(" · ")}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onCreateAnother}
          accessibilityRole="button"
          accessibilityLabel="Create another project"
          className="min-h-14 flex-1 items-center justify-center rounded-lg border border-n600 active:opacity-80"
        >
          <Text className="text-h4 text-white">Create another</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel="Done"
          className="min-h-14 flex-1 items-center justify-center rounded-lg bg-aura-purple active:opacity-80"
        >
          <Text className="text-h4 text-white">Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
