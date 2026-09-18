import * as SecureStore from "expo-secure-store";

/**
 * Single source of truth for the onboarding-completion storage key, so it
 * isn't duplicated across the app. Backed by expo-secure-store, the
 * persistence mechanism already used for Clerk's token cache.
 */
const ONBOARDING_COMPLETED_KEY = "auraStack.onboarding.completed";

export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
    return value === "true";
  } catch (err) {
    console.error("[onboardingStorage] failed to read onboarding state", err);
    return false;
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, "true");
  } catch (err) {
    console.error("[onboardingStorage] failed to persist onboarding state", err);
  }
}
