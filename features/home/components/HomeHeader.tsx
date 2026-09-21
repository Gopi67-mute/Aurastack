import { useUser } from "@clerk/expo";
import { Image } from "expo-image";
import { User as UserIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";

const AVATAR_SIZE = 44;
const FALLBACK_NAME = "there";

/**
 * Greeting + top-right profile picture. The avatar uses Clerk's
 * `user.imageUrl` from useUser(), the same authenticated-user source as the
 * Profile tab (which has no image of its own yet, only an icon placeholder).
 */
export function HomeHeader() {
  const { user } = useUser();
  const firstName = user?.firstName?.trim() || FALLBACK_NAME;

  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-h2 text-white" numberOfLines={1}>
          Hello, {firstName}! 👋
        </Text>
        <Text className="mt-1 text-body-lg text-aura-indigo">
          Build something amazing today.
        </Text>
      </View>

      <View
        accessibilityLabel="Your profile picture"
        className="items-center justify-center overflow-hidden rounded-full border border-n600 bg-n700"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        {user?.imageUrl ? (
          <Image
            source={{ uri: user.imageUrl }}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            contentFit="cover"
          />
        ) : (
          <UserIcon size={22} color={colors.neutral.n300} strokeWidth={1.75} />
        )}
      </View>
    </View>
  );
}
