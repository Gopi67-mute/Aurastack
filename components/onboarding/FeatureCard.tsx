import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor: string;
  accentBgClassName: string;
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  accentColor,
  accentBgClassName,
}: FeatureCardProps) {
  return (
    <View className="w-full flex-row items-center gap-4 rounded-xl border border-n700 bg-n800 p-4">
      <View
        className={`w-12 h-12 rounded-md items-center justify-center ${accentBgClassName}`}
      >
        <Icon size={24} color={accentColor} strokeWidth={1.75} />
      </View>

      <View className="flex-1">
        <Text className="text-h4 text-white">{title}</Text>
        <Text className="mt-1 text-body-sm text-n300">{description}</Text>
      </View>
    </View>
  );
}
