import type { AuthMode } from "../types/auth";

export const VERIFICATION_CODE_LENGTH = 6;

type AuthCopy = {
  title: string;
  subtitle: string;
  footerPrompt: string;
  footerActionLabel: string;
  footerActionHref: "/sign-up" | "/sign-in";
};

export const AUTH_COPY: Record<AuthMode, AuthCopy> = {
  "sign-up": {
    title: "Welcome to AuraStack",
    subtitle: "Turn your idea into a structured project.",
    footerPrompt: "Already have an account?",
    footerActionLabel: "Log in",
    footerActionHref: "/sign-in",
  },
  "sign-in": {
    title: "Welcome back",
    subtitle: "Sign in to continue building your project.",
    footerPrompt: "Don't have an account?",
    footerActionLabel: "Sign up",
    footerActionHref: "/sign-up",
  },
};
