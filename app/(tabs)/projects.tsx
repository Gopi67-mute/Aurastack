import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Projects() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-n900 px-8"
      style={{ paddingTop: insets.top }}
    >
      <Text className="text-h1 text-white text-center">Projects</Text>
      <Text className="mt-3 text-body-lg text-n300 text-center">
        Your projects, architecture, stack, and roadmaps will show up here.
      </Text>
    </View>
  );
}
