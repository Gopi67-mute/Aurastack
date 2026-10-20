import { Text, View } from "react-native";

import type { ProfileIdentity } from "../types/profile";
import { ProfileAvatar } from "./ProfileAvatar";

const TAGLINE = "Build today. Create tomorrow. 🚀";

interface ProfileHeaderProps {
  identity: ProfileIdentity;
}

/** Screen title with the AuraStack wordmark, then who is signed in. */
export function ProfileHeader({ identity }: ProfileHeaderProps) {
  return (
    <View>
      <View className="flex-row items-center justify-between gap-4">
        <Text accessibilityRole="header" className="text-h1 text-white">
          Profile
        </Text>
        <Text accessibilityLabel="AuraStack" className="text-h4 text-white">
          Aura<Text className="text-aura-blue">Stack</Text>
        </Text>
      </View>

      <View className="mt-6 flex-row items-center gap-4">
        <ProfileAvatar initials={identity.initials} imageUrl={identity.imageUrl} />
        <View className="flex-1">
          <Text className="text-h2 text-white" numberOfLines={1}>
            {identity.displayName}
          </Text>
          {identity.email ? (
            <Text
              className="mt-1 text-body-md text-n100"
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {identity.email}
            </Text>
          ) : null}
          <Text className="mt-2 text-body-sm text-n300">{TAGLINE}</Text>
        </View>
      </View>
    </View>
  );
}
