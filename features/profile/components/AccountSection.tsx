import Constants from "expo-constants";
import { ChevronRight, Info, LogOut, ShieldCheck } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "../../../theme/colors";

const PRIVACY_TEXT =
  "Sign-in is handled by Clerk. Your projects and learning are tied to your account, " +
  "and none of it is cached on this device after you sign out.";

/** The version configured in app.json; null if the build exposes none. */
const APP_VERSION = Constants.expoConfig?.version ?? null;

interface InfoRowProps {
  icon: LucideIcon;
  iconColor: string;
  iconTileClassName: string;
  title: string;
  description: string;
}

/** Read-only information: no chevron, not pressable, so it never looks like a dead button. */
function InfoRow({ icon: Icon, iconColor, iconTileClassName, title, description }: InfoRowProps) {
  return (
    <View accessible className="flex-row items-start gap-3 border-b border-n600 py-3">
      <View className={`h-11 w-11 items-center justify-center rounded-lg ${iconTileClassName}`}>
        <Icon size={20} color={iconColor} strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text className="text-h4 text-white">{title}</Text>
        <Text className="mt-1 text-body-sm text-n300">{description}</Text>
      </View>
    </View>
  );
}

interface AccountSectionProps {
  onSignOutPress: () => void;
  isSigningOut: boolean;
  signOutError: string | null;
}

export function AccountSection({ onSignOutPress, isSigningOut, signOutError }: AccountSectionProps) {
  return (
    <View className="rounded-xl border border-n600 bg-n800 p-4">
      <Text accessibilityRole="header" className="text-h3 text-white">
        Account
      </Text>

      <View className="mt-1">
        <InfoRow
          icon={ShieldCheck}
          iconColor={colors.brand.auraTeal}
          iconTileClassName="bg-aura-teal/15"
          title="Privacy & Security"
          description={PRIVACY_TEXT}
        />
        {APP_VERSION ? (
          <InfoRow
            icon={Info}
            iconColor={colors.neutral.n100}
            iconTileClassName="bg-n600"
            title="About AuraStack"
            description={`Version ${APP_VERSION}`}
          />
        ) : null}
      </View>

      <Pressable
        onPress={onSignOutPress}
        disabled={isSigningOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: isSigningOut, busy: isSigningOut }}
        className={`mt-4 min-h-14 flex-row items-center justify-between rounded-lg border border-error/50 bg-error/10 px-4 active:opacity-80 ${
          isSigningOut ? "opacity-60" : ""
        }`}
      >
        <View className="flex-row items-center gap-3">
          <LogOut size={20} color={colors.semantic.error} />
          <Text className="text-h4 text-error">{isSigningOut ? "Signing out…" : "Sign Out"}</Text>
        </View>
        {isSigningOut ? (
          <ActivityIndicator color={colors.semantic.error} />
        ) : (
          <ChevronRight size={18} color={colors.semantic.error} />
        )}
      </Pressable>

      {signOutError ? (
        <Text accessibilityLiveRegion="polite" className="mt-3 text-body-sm text-error text-center">
          {signOutError}
        </Text>
      ) : (
        <Text className="mt-3 text-body-sm text-n300">
          You&apos;ll be signed out of your account on this device.
        </Text>
      )}
    </View>
  );
}
