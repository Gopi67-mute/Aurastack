import { Redirect } from "expo-router";
import { View } from "react-native";

import { useAppDestination } from "../hooks/useAppBootstrap";

const DESTINATION_ROUTES = {
  onboarding: "/onboarding",
  auth: "/sign-in",
  home: "/home",
} as const;

export default function Index() {
  const destination = useAppDestination();

  // _layout only renders this route once bootstrap status is "ready", and
  // status/destination are set together (see useAppBootstrap), so this is a
  // transient guard, not a dead end.
  if (!destination) {
    return <View className="flex-1 bg-n900" />;
  }

  return (
    <View className="flex-1 bg-n900">
      <Redirect href={DESTINATION_ROUTES[destination]} />
    </View>
  );
}
