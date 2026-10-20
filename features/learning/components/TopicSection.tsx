import { Text, View } from "react-native";

interface TopicSectionProps {
  title: string;
  body: string;
}

export function TopicSection({ title, body }: TopicSectionProps) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <Text className="text-h4 text-white">{title}</Text>
      <Text className="mt-2 text-body-md text-n100">{body}</Text>
    </View>
  );
}
