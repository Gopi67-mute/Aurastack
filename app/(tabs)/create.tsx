import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Create() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-n900 px-8"
      style={{ paddingTop: insets.top }}
    >
      <Text className="text-h1 text-white text-center">Create a project</Text>
      <Text className="mt-3 text-body-lg text-n300 text-center">
        The guided project creation flow is coming soon.
      </Text>
    </View>
  );
}
