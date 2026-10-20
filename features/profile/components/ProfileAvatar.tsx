import { Image } from "expo-image";
import { User as UserIcon } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { colors } from "../../../theme/colors";

const AVATAR_SIZE = 88;

interface ProfileAvatarProps {
  initials: string;
  imageUrl: string | null;
}

/**
 * The user's photo when they have one; otherwise their initials on the brand
 * gradient (an icon if no initials can be derived). Never a broken image.
 */
export function ProfileAvatar({ initials, imageUrl }: ProfileAvatarProps) {
  return (
    <View
      testID="profile-avatar"
      accessible
      accessibilityRole="image"
      accessibilityLabel={imageUrl ? "Your profile photo" : `Avatar, ${initials || "no initials"}`}
      className="items-center justify-center overflow-hidden rounded-full border-2 border-aura-purple/40"
      style={styles.avatar}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <LinearGradient id="profileAvatarGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.brand.auraPurple} />
                <Stop offset="1" stopColor={colors.brand.auraIndigo} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#profileAvatarGradient)" />
          </Svg>
          {initials ? (
            <Text className="text-h1 text-white">{initials}</Text>
          ) : (
            <UserIcon size={36} color={colors.neutral.white} strokeWidth={1.75} />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
});
