import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { LogOut, User as UserIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { resetUserStores } from "../../store/resetUserStores";
import { colors } from "../../theme/colors";

// useAppBootstrap recomputes the shared destination asynchronously when
// isSignedIn flips (see hooks/useAppBootstrap.ts), so this waits a beat
// past that flip before re-entering "/" — otherwise index.tsx could read a
// stale destination and redirect straight back into the tabs.
const NAVIGATE_AFTER_SIGN_OUT_DELAY_MS = 150;

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSigningOut || isSignedIn !== false) return;

    const timer = setTimeout(() => {
      router.replace("/");
    }, NAVIGATE_AFTER_SIGN_OUT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isSigningOut, isSignedIn, router]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      // Only after success: a failed sign-out keeps the user and their data.
      resetUserStores();
      // The effect above navigates once isSignedIn flips to false.
    } catch {
      setIsSigningOut(false);
      setSignOutError("Something went wrong signing out. Please try again.");
    }
  }

  return (
    <View
      className="flex-1 bg-n900 px-6"
      style={{ paddingTop: insets.top + 16 }}
    >
      <Text className="text-h1 text-white">Profile</Text>

      <View className="mt-6 flex-row items-center gap-4 rounded-xl border border-n700 bg-n800 p-4">
        <View className="w-12 h-12 rounded-full items-center justify-center bg-n700">
          <UserIcon size={24} color={colors.neutral.n300} strokeWidth={1.75} />
        </View>
        <View className="flex-1">
          <Text className="text-h4 text-white" numberOfLines={1}>
            {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your account"}
          </Text>
          {user?.primaryEmailAddress ? (
            <Text className="mt-1 text-body-sm text-n300" numberOfLines={1}>
              {user.primaryEmailAddress.emailAddress}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-8">
        <Text className="text-body-sm text-n300 mb-3">Account</Text>

        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          className={`flex-row items-center justify-between rounded-xl border border-error/30 bg-error/10 px-4 py-4 ${
            isSigningOut ? "opacity-60" : ""
          }`}
        >
          <View className="flex-row items-center gap-3">
            <LogOut size={20} color={colors.semantic.error} />
            <Text className="text-h4 text-error">Sign Out</Text>
          </View>
          {isSigningOut ? <ActivityIndicator color={colors.semantic.error} /> : null}
        </Pressable>

        {signOutError ? (
          <Text className="mt-3 text-body-sm text-error text-center">
            {signOutError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
