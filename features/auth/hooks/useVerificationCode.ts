import { useCallback, useRef, useState } from "react";
import type { TextInput } from "react-native";

import { VERIFICATION_CODE_LENGTH } from "../constants/copy";

export function useVerificationCode(
  onComplete: (code: string) => void | boolean | Promise<void | boolean>
) {
  const [code, setCode] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback(
    (text: string) => {
      const digitsOnly = text.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH);
      setCode(digitsOnly);
      if (digitsOnly.length === VERIFICATION_CODE_LENGTH) {
        // Callers signal a failed attempt by resolving `false`, which clears
        // the input so the user can retry without manually deleting digits.
        Promise.resolve(onComplete(digitsOnly)).then((result) => {
          if (result === false) {
            setCode("");
          }
        });
      }
    },
    [onComplete]
  );

  const focus = useCallback(() => inputRef.current?.focus(), []);
  const reset = useCallback(() => setCode(""), []);

  return { code, inputRef, handleChangeText, focus, reset };
}
