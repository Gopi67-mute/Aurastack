import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Home() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar style="light" />
      <View
        className="flex-1 items-center justify-center bg-n900 px-8"
        style={{ paddingTop: insets.top }}
      >
        <Text className="text-h1 text-white text-center">You&apos;re in</Text>
        <Text className="mt-3 text-body-lg text-n300 text-center">
          The AuraStack home experience is coming soon.
        </Text>
      </View>
    </>
  );
}
