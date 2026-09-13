import { useFonts } from "expo-font";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Splash/init state machine for the app entry flow.
 *
 * "loading"  — native splash is visible, bootstrap is running.
 * "ready"    — bootstrap succeeded; `destination` says where to route next.
 * "error"    — bootstrap failed (or hung past the safety timeout); the caller
 *              should show a recoverable fallback and offer `retry()`.
 */
export type AppBootstrapStatus = "loading" | "ready" | "error";

/**
 * Where the app should route to once bootstrap completes. Nothing currently
 * consumes this to navigate — onboarding/auth/home screens don't exist yet —
 * but the value is computed here so that wiring is a routing-only change
 * later, not a state-machine change.
 */
export type AppDestination = "onboarding" | "auth" | "home";

export interface AppBootstrapState {
  status: AppBootstrapStatus;
  destination: AppDestination | null;
  error: string | null;
  retry: () => void;
}

// Target ~1.5s on screen; this is the floor, not a hard duration — slower
// devices may take longer to finish real init work above this floor.
const MIN_SPLASH_DURATION_MS = 1500;

// Backstop only: if bootstrap hasn't resolved by this point, something is
// hung. Surface the error fallback instead of leaving the splash stuck.
const SAFETY_TIMEOUT_MS = 6000;

/**
 * Placeholder. Replace with a persisted onboarding flag (AsyncStorage /
 * SecureStore — pending approval) once the onboarding flow is built.
 */
async function getOnboardingCompleted(): Promise<boolean> {
  return false;
}

/**
 * Placeholder. Replace with Clerk's session check once authentication is
 * wired up.
 */
async function getAuthSession(): Promise<{ isAuthenticated: boolean } | null> {
  return null;
}

function resolveDestination(
  onboardingCompleted: boolean,
  isAuthenticated: boolean
): AppDestination {
  if (!onboardingCompleted) return "onboarding";
  if (!isAuthenticated) return "auth";
  return "home";
}

export function useAppBootstrap(): AppBootstrapState {
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  const [status, setStatus] = useState<AppBootstrapStatus>("loading");
  const [destination, setDestination] = useState<AppDestination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Set once on mount so retries don't restart the minimum-duration clock.
  const startedAtRef = useRef(Date.now());

  const retry = useCallback(() => {
    startedAtRef.current = Date.now();
    setStatus("loading");
    setDestination(null);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const safetyTimer = setTimeout(() => {
      if (cancelled) return;
      console.error("[useAppBootstrap] initialization exceeded safety timeout");
      setError("Startup is taking longer than expected.");
      setStatus("error");
    }, SAFETY_TIMEOUT_MS);

    async function run() {
      try {
        if (fontError) {
          throw fontError;
        }
        if (!fontsLoaded) {
          // Effect re-runs once useFonts resolves (it's in the dep array).
          return;
        }

        const [onboardingCompleted, session] = await Promise.all([
          getOnboardingCompleted(),
          getAuthSession(),
        ]);

        const nextDestination = resolveDestination(
          onboardingCompleted,
          !!session?.isAuthenticated
        );

        const elapsed = Date.now() - startedAtRef.current;
        const remaining = Math.max(MIN_SPLASH_DURATION_MS - elapsed, 0);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }

        if (cancelled) return;
        clearTimeout(safetyTimer);
        setDestination(nextDestination);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        clearTimeout(safetyTimer);
        console.error("[useAppBootstrap] initialization failed", err);
        setError("We couldn't start AuraStack. Please try again.");
        setStatus("error");
      }
    }

    run();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, [fontsLoaded, fontError, attempt]);

  return { status, destination, error, retry };
}
