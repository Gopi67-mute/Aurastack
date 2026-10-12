import { useCallback, useEffect } from "react";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import type { RemoteStatus } from "../../../lib/remoteData";
import { EMPTY_CONVERSATION, mentorContextKey, useMentorStore } from "../../../store/useMentorStore";
import { useProjects } from "../../projects/hooks/useProjects";
import type { Project } from "../../projects/types/projects";
import type { MentorConversation } from "../types/mentor";

export interface UseMentorChatResult {
  projects: readonly Project[];
  projectsStatus: RemoteStatus;
  projectsError: string | null;
  refreshProjects: () => Promise<void>;
  /** Null for general mentoring. */
  selectedProject: Project | null;
  selectProject: (projectId: string | null) => void;
  /** The selected context's conversation. */
  conversation: MentorConversation;
  /** Fetches the selected context's saved conversation again after a failure. */
  retryLoad: () => void;
  send: (content: string) => void;
  retry: () => void;
  /** The failed latest message's text, removed from the conversation for editing. */
  takeFailedMessage: () => string | null;
  clearConversation: () => void;
}

/**
 * The AI Mentor screen's data: the user's projects (shared with the rest of
 * the app through the project store) for the context selector, and the
 * selected context's conversation from the mentor store, fetched from the
 * server the first time that context is shown.
 */
export function useMentorChat(): UseMentorChatResult {
  const getToken = useStableGetToken();
  const { projects, status: projectsStatus, error: projectsError, refresh: refreshProjects } = useProjects();

  const selectedProjectId = useMentorStore((state) => state.selectedProjectId);
  const conversation = useMentorStore(
    (state) => state.conversations[mentorContextKey(state.selectedProjectId)] ?? EMPTY_CONVERSATION,
  );
  const selectProject = useMentorStore((state) => state.selectProject);
  const loadConversation = useMentorStore((state) => state.loadConversation);
  const sendMessage = useMentorStore((state) => state.send);
  const retryMessage = useMentorStore((state) => state.retry);
  const takeFailedMessage = useMentorStore((state) => state.takeFailedMessage);
  const clearSelected = useMentorStore((state) => state.clearConversation);

  const selectedProject = selectedProjectId
    ? (projects.find((project) => project.id === selectedProjectId) ?? null)
    : null;

  // A selected project that is gone from a freshly loaded list (deleted
  // elsewhere) falls back to general mentoring instead of a dead context.
  useEffect(() => {
    if (selectedProjectId && projectsStatus === "ready" && !selectedProject) selectProject(null);
  }, [selectedProjectId, projectsStatus, selectedProject, selectProject]);

  // Runs again when the context changes, or when a sign-out reset its
  // conversation back to "idle".
  useEffect(() => {
    void loadConversation(getToken);
  }, [loadConversation, getToken, selectedProjectId, conversation.status]);

  const retryLoad = useCallback(() => void loadConversation(getToken, true), [loadConversation, getToken]);
  const send = useCallback((content: string) => void sendMessage(content, getToken), [sendMessage, getToken]);
  const retry = useCallback(() => void retryMessage(getToken), [retryMessage, getToken]);
  const clearConversation = useCallback(() => void clearSelected(getToken), [clearSelected, getToken]);

  return {
    projects,
    projectsStatus,
    projectsError,
    refreshProjects,
    selectedProject,
    selectProject,
    conversation,
    retryLoad,
    send,
    retry,
    takeFailedMessage,
    clearConversation,
  };
}
