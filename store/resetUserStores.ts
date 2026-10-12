import { useLearningStore } from "./useLearningStore";
import { useMentorStore } from "./useMentorStore";
import { useMomentumStore } from "./useMomentumStore";
import { useProjectStore } from "./useProjectStore";

/**
 * Forgets everything the stores hold for the signed-in user: data, errors,
 * generation polling and any response still in flight. Call once sign-out has
 * succeeded, so the next user to sign in starts from fresh server loads and
 * never sees the previous user's projects, learning, streak or mentor chats.
 */
export function resetUserStores(): void {
  useProjectStore.getState().reset();
  useLearningStore.getState().reset();
  useMomentumStore.getState().reset();
  useMentorStore.getState().reset();
}
