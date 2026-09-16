import { FontAwesome6 } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { SocialProvider } from "../types/auth";

type ProviderConfig = {
  label: string;
  iconName: string;
  iconColor: string;
  iconBgClassName?: string;
  containerClassName: string;
  labelClassName: string;
};

const PROVIDER_CONFIG: Record<SocialProvider, ProviderConfig> = {
  google: {
    label: "Continue with Google",
    iconName: "google",
    iconColor: "#4285F4",
    containerClassName: "bg-white",
    labelClassName: "text-n900",
  },
  facebook: {
    label: "Continue with Facebook",
    iconName: "facebook",
    iconColor: "#FFFFFF",
    iconBgClassName: "bg-[#1877F2]",
    containerClassName: "bg-n800 border border-n700",
    labelClassName: "text-white",
  },
  x: {
    label: "Continue with X",
    iconName: "x-twitter",
    iconColor: "#FFFFFF",
    containerClassName: "bg-n800 border border-n700",
    labelClassName: "text-white",
  },
};

type SocialAuthButtonProps = {
  provider: SocialProvider;
  onPress: () => void;
};

export function SocialAuthButton({ provider, onPress }: SocialAuthButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={config.label}
      className={`w-full flex-row items-center gap-3 rounded-xl px-5 py-4 ${config.containerClassName}`}
    >
      {config.iconBgClassName ? (
        <View
          className={`w-6 h-6 rounded-full items-center justify-center ${config.iconBgClassName}`}
        >
          <FontAwesome6 name={config.iconName} brand size={13} color={config.iconColor} />
        </View>
      ) : (
        <FontAwesome6 name={config.iconName} brand size={20} color={config.iconColor} />
      )}
      <Text className={`flex-1 text-center text-h4 ${config.labelClassName}`}>
        {config.label}
      </Text>
    </Pressable>
  );
}
