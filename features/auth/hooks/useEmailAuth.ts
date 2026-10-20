import { useSignIn, useSignUp } from "@clerk/expo";
import { useCallback, useRef, useState } from "react";

import type { AuthMode } from "../types/auth";

type ClerkErrorLike = { message: string; longMessage?: string };

function toMessage(error: ClerkErrorLike | null): string | null {
  if (!error) return null;
  return error.longMessage ?? error.message;
}

type UseEmailAuthResult = {
  pendingEmail: string | null;
  emailError: string | null;
  codeError: string | null;
  isProcessing: boolean;
  submitEmail: (email: string) => Promise<void>;
  verifyCode: (code: string) => Promise<boolean>;
  cancelVerification: () => void;
};

/**
 * Drives Clerk's passwordless email-code flow for both sign-up and sign-in,
 * matching the app's existing "enter email, then enter code" UI. Sign-in
 * uses email_code, the only first factor enabled for this Clerk instance.
 */
export function useEmailAuth(mode: AuthMode, onVerified: () => void): UseEmailAuthResult {
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const submitEmail = useCallback(
    async (email: string) => {
      setEmailError(null);
      setCodeError(null);

      if (mode === "sign-up") {
        const { error } = await signUp.create({ emailAddress: email });
        if (error) {
          setEmailError(toMessage(error));
          return;
        }

        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          setEmailError(toMessage(sendError));
          return;
        }
      } else {
        const { error } = await signIn.emailCode.sendCode({ emailAddress: email });
        if (error) {
          setEmailError(toMessage(error));
          return;
        }
      }

      setPendingEmail(email);
    },
    [mode, signIn, signUp]
  );

  // The code input stays editable while a code is verifying, so a second full
  // code could otherwise start a parallel verify and fire onVerified (a screen
  // replace) twice. Stays set after success: the screen is on its way out.
  const isVerifyingRef = useRef(false);

  const finishVerification = useCallback(
    async (code: string): Promise<boolean> => {
      if (mode === "sign-up") {
        const { error } = await signUp.verifications.verifyEmailCode({ code });
        if (error) {
          setCodeError(toMessage(error));
          return false;
        }

        if (signUp.status !== "complete") {
          setCodeError("Something went wrong. Please try again.");
          return false;
        }

        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setCodeError(toMessage(finalizeError));
          return false;
        }
      } else {
        const { error } = await signIn.emailCode.verifyCode({ code });
        if (error) {
          setCodeError(toMessage(error));
          return false;
        }

        if (signIn.status !== "complete") {
          setCodeError("Something went wrong. Please try again.");
          return false;
        }

        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setCodeError(toMessage(finalizeError));
          return false;
        }
      }
      return true;
    },
    [mode, signIn, signUp]
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (isVerifyingRef.current) return false;
      isVerifyingRef.current = true;
      setCodeError(null);

      let verified = false;
      try {
        verified = await finishVerification(code);
      } finally {
        if (!verified) isVerifyingRef.current = false;
      }
      if (!verified) return false;

      // pendingEmail is deliberately left set: onVerified replaces this
      // screen, which unmounts the modal with it. Clearing it here only adds
      // a redundant update to a screen that is being removed.
      onVerified();
      return true;
    },
    [finishVerification, onVerified]
  );

  const cancelVerification = useCallback(() => {
    isVerifyingRef.current = false;
    setPendingEmail(null);
    setCodeError(null);
    if (mode === "sign-up") {
      signUp.reset();
    } else {
      signIn.reset();
    }
  }, [mode, signIn, signUp]);

  return {
    pendingEmail,
    emailError,
    codeError,
    isProcessing:
      mode === "sign-up" ? signUpFetchStatus === "fetching" : signInFetchStatus === "fetching",
    submitEmail,
    verifyCode,
    cancelVerification,
  };
}
