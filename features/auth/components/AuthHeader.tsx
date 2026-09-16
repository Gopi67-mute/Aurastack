import { Text, View } from "react-native";

type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <View className="w-full">
      <Text className="mt-6 text-ai-accent text-h1">{title}</Text>
      <Text className="mt-2 text-body-lg text-n300">{subtitle}</Text>
    </View>
  );
}
