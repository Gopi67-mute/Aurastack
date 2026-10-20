import { useAuth, useClerk } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { resetUserStores } from "../../../store/resetUserStores";

// Where app/index.tsx sends a signed-out user: the auth screens are only
// reachable after onboarding-3 stores the onboarding flag. Replacing straight
// to it is a single screen transition; going through "/" stacked a second
// replace (index's <Redirect>) on top of the tabs' exit transition.
const SIGNED_OUT_ROUTE = "/sign-in";

const SIGN_OUT_ERROR = "Something went wrong signing out. Please try again.";

export interface UseSignOutResult {
  /** Asks for confirmation first; signs out only if the user confirms. */
  requestSignOut: () => void;
  isSigningOut: boolean;
  error: string | null;
}

/**
 * Signs the user out through Clerk, then forgets their data and leaves the
 * tabs. A failed sign-out keeps the user signed in with their data intact.
 */
export function useSignOut(): UseSignOutResult {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasSignedOut, setHasSignedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  // A ref, not state: two confirmations in the same frame both read it.
  const isSigningOutRef = useRef(false);

  // Navigates in its own commit, after the store reset has already re-rendered
  // the tabs, so nothing updates them while they transition out. Waits for
  // Clerk to report the signed-out state, and fires at most once.
  useEffect(() => {
    if (!hasSignedOut || isSignedIn !== false || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.replace(SIGNED_OUT_ROUTE);
  }, [hasSignedOut, isSignedIn, router]);

  async function handleSignOut() {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      // Only after success: a failed sign-out keeps the user and their data.
      resetUserStores();
      setHasSignedOut(true);
    } catch {
      isSigningOutRef.current = false;
      setIsSigningOut(false);
      setError(SIGN_OUT_ERROR);
    }
  }

  function requestSignOut() {
    if (isSigningOutRef.current) return;
    Alert.alert("Sign out?", "You'll be signed out of AuraStack on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: handleSignOut },
    ]);
  }

  return { requestSignOut, isSigningOut, error };
}
