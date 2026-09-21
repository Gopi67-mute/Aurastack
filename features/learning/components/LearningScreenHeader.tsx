import { ChevronLeft } from "lucide-react-native";
import { Pressable, Text } from "react-native";

import { colors } from "../../../theme/colors";

interface LearningScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
}

/** Back button + title block shared by the Learning screens. */
export function LearningScreenHeader({ title, subtitle, onBack }: LearningScreenHeaderProps) {
  return (
    <>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-n600 bg-n800 active:opacity-80"
      >
        <ChevronLeft size={20} color={colors.neutral.white} />
      </Pressable>

      <Text className="text-h1 text-white">{title}</Text>
      {subtitle ? <Text className="mt-1 text-body-md text-n300">{subtitle}</Text> : null}
    </>
  );
}
