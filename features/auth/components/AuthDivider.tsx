import { Text, View } from "react-native";

export function AuthDivider() {
  return (
    <View className="w-full flex-row items-center gap-4">
      <View className="flex-1 h-px bg-n700" />
      <Text className="text-body-sm text-n300">or continue with</Text>
      <View className="flex-1 h-px bg-n700" />
    </View>
  );
}
