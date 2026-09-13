import { Redirect } from "expo-router";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View>
      <Redirect href="/onboarding" />
      <Text className="text-h1 text-black">AuraStack</Text>
      <Text className="text-body-lg text-n300">AI Project Architect</Text>
    </View>
  );
}
