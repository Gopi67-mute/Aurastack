import { act, render } from "@testing-library/react-native";
import { Keyboard, LayoutAnimation, type KeyboardEvent } from "react-native";

import { VerificationModal } from "./VerificationModal";

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type KeyboardListener = (event: KeyboardEvent) => void;

const listeners = new Map<string, KeyboardListener>();
let configureNext: jest.SpyInstance;

beforeEach(() => {
  listeners.clear();
  jest.spyOn(Keyboard, "addListener").mockImplementation((eventName, listener) => {
    listeners.set(eventName, listener as KeyboardListener);
    return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
  });
  configureNext = jest.spyOn(LayoutAnimation, "configureNext").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function keyboardEvent(height: number): KeyboardEvent {
  return { endCoordinates: { height } } as KeyboardEvent;
}

/** Fires whichever show/hide event the current platform subscribes to. */
function emit(kind: "Show" | "Hide", height = 0) {
  const listener = listeners.get(`keyboardDid${kind}`) ?? listeners.get(`keyboardWill${kind}`);
  if (!listener) throw new Error(`no keyboard ${kind} listener`);
  act(() => listener(keyboardEvent(height)));
}

describe("VerificationModal keyboard animation", () => {
  it("queues a layout animation only when the keyboard height changes", () => {
    render(
      <VerificationModal
        visible
        email="user@example.com"
        onClose={jest.fn()}
        onVerify={jest.fn().mockResolvedValue(false)}
      />,
    );

    emit("Show", 300);
    expect(configureNext).toHaveBeenCalledTimes(1);

    // A repeated event with the same height re-renders nothing, so it must not
    // leave an animation pending for some unrelated later commit.
    emit("Show", 300);
    expect(configureNext).toHaveBeenCalledTimes(1);

    emit("Hide");
    expect(configureNext).toHaveBeenCalledTimes(2);
    emit("Hide");
    expect(configureNext).toHaveBeenCalledTimes(2);
  });
});
