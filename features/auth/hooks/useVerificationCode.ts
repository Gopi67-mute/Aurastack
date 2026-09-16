import { useCallback, useRef, useState } from "react";
import type { TextInput } from "react-native";

import { VERIFICATION_CODE_LENGTH } from "../constants/copy";

export function useVerificationCode(onComplete: (code: string) => void) {
  const [code, setCode] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = useCallback(
    (text: string) => {
      const digitsOnly = text.replace(/\D/g, "").slice(0, VERIFICATION_CODE_LENGTH);
      setCode(digitsOnly);
      if (digitsOnly.length === VERIFICATION_CODE_LENGTH) {
        onComplete(digitsOnly);
      }
    },
    [onComplete]
  );

  const focus = useCallback(() => inputRef.current?.focus(), []);
  const reset = useCallback(() => setCode(""), []);

  return { code, inputRef, handleChangeText, focus, reset };
}
