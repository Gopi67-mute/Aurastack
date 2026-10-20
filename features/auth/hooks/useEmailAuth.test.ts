import { act, renderHook } from "@testing-library/react-native";

import { useEmailAuth } from "./useEmailAuth";

type ClerkResult = { error: { message: string } | null };

const mockSignIn = {
  status: "needs_first_factor",
  emailCode: {
    sendCode: jest.fn<Promise<ClerkResult>, [unknown]>(),
    verifyCode: jest.fn<Promise<ClerkResult>, [unknown]>(),
  },
  finalize: jest.fn<Promise<ClerkResult>, []>(),
  reset: jest.fn(),
};

jest.mock("@clerk/expo", () => ({
  useSignIn: () => ({ signIn: mockSignIn, fetchStatus: "idle" }),
  useSignUp: () => ({ signUp: {}, fetchStatus: "idle" }),
}));

const ok: ClerkResult = { error: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.status = "needs_first_factor";
  mockSignIn.emailCode.sendCode.mockResolvedValue(ok);
  mockSignIn.finalize.mockResolvedValue(ok);
});

async function renderWithPendingEmail(onVerified: () => void) {
  const hook = renderHook(() => useEmailAuth("sign-in", onVerified));
  await act(async () => {
    await hook.result.current.submitEmail("user@example.com");
  });
  return hook;
}

describe("useEmailAuth verifyCode", () => {
  it("navigates once on success and leaves the replaced screen's state alone", async () => {
    const onVerified = jest.fn();
    mockSignIn.emailCode.verifyCode.mockImplementation(async () => {
      mockSignIn.status = "complete";
      return ok;
    });
    const { result } = await renderWithPendingEmail(onVerified);

    let verified: boolean | undefined;
    await act(async () => {
      verified = await result.current.verifyCode("123456");
    });

    expect(verified).toBe(true);
    expect(onVerified).toHaveBeenCalledTimes(1);
    // No extra update to the screen that onVerified is replacing.
    expect(result.current.pendingEmail).toBe("user@example.com");
  });

  it("ignores a second code while the first is still verifying", async () => {
    const onVerified = jest.fn();
    let answer: (result: ClerkResult) => void = () => {};
    mockSignIn.emailCode.verifyCode.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    const { result } = await renderWithPendingEmail(onVerified);

    let first: Promise<boolean> = Promise.resolve(false);
    let second: boolean | undefined;
    await act(async () => {
      first = result.current.verifyCode("123456");
      second = await result.current.verifyCode("654321");
    });
    expect(second).toBe(false);

    await act(async () => {
      mockSignIn.status = "complete";
      answer(ok);
      await first;
    });

    expect(mockSignIn.emailCode.verifyCode).toHaveBeenCalledTimes(1);
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("allows another attempt after a wrong code", async () => {
    const onVerified = jest.fn();
    mockSignIn.emailCode.verifyCode
      .mockResolvedValueOnce({ error: { message: "Incorrect code" } })
      .mockImplementationOnce(async () => {
        mockSignIn.status = "complete";
        return ok;
      });
    const { result } = await renderWithPendingEmail(onVerified);

    await act(async () => {
      expect(await result.current.verifyCode("000000")).toBe(false);
    });
    expect(result.current.codeError).toBe("Incorrect code");
    expect(onVerified).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.verifyCode("123456")).toBe(true);
    });
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("allows a new attempt after cancelling a verification that never answered", async () => {
    mockSignIn.emailCode.verifyCode.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await renderWithPendingEmail(jest.fn());

    act(() => {
      void result.current.verifyCode("123456");
    });
    act(() => result.current.cancelVerification());
    expect(result.current.pendingEmail).toBeNull();

    mockSignIn.emailCode.verifyCode.mockResolvedValueOnce({ error: { message: "Incorrect code" } });
    await act(async () => {
      await result.current.verifyCode("000000");
    });
    expect(mockSignIn.emailCode.verifyCode).toHaveBeenCalledTimes(2);
  });
});
