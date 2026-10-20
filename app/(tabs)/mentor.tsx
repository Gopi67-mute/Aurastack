import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, type TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { MentorComposer } from "../../features/mentor/components/MentorComposer";
import { MentorHeader } from "../../features/mentor/components/MentorHeader";
import { MentorThread } from "../../features/mentor/components/MentorThread";
import { MentorWelcome } from "../../features/mentor/components/MentorWelcome";
import { ProjectContextSelector } from "../../features/mentor/components/ProjectContextSelector";
import { useMentorChat } from "../../features/mentor/hooks/useMentorChat";
import type { QuickActionKey } from "../../features/mentor/types/mentor";
import { getQuickActionPrompt } from "../../features/mentor/utils/getQuickActionPrompt";
import { GlowBackdrop } from "../../features/profile/components/GlowBackdrop";

export default function Mentor() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  // Local: the draft survives a failed send, and switching context keeps it.
  const [draft, setDraft] = useState("");
  const {
    projects,
    projectsStatus,
    refreshProjects,
    selectedProject,
    selectProject,
    conversation,
    retryLoad,
    send,
    retry,
    takeFailedMessage,
    clearConversation,
  } = useMentorChat();

  const isReady = conversation.status === "ready";
  const hasMessages = conversation.messages.length > 0;

  const compose = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (!draft.trim() || !isReady || conversation.isSending) return;
    send(draft);
    setDraft("");
  };

  const handleQuickAction = (key: QuickActionKey) => {
    const prompt = getQuickActionPrompt(key, selectedProject !== null);
    if (prompt.mode === "send") send(prompt.text);
    else compose(prompt.text);
  };

  const handleEditFailed = () => {
    const text = takeFailedMessage();
    if (text === null) return;
    // Never overwrite something typed since: the failed text goes first.
    compose(draft.trim() ? `${text}\n${draft}` : text);
  };

  const renderConversation = () => {
    if (conversation.status === "error") {
      return (
        <View className="flex-1 px-4 pt-4" accessibilityLiveRegion="polite">
          <ErrorState message={conversation.error ?? "Couldn't load your conversation."} onRetry={retryLoad} />
        </View>
      );
    }
    if (!isReady) {
      return (
        <View className="flex-1 px-4 pt-4">
          <LoadingState label="conversation" />
        </View>
      );
    }
    if (!hasMessages) {
      return <MentorWelcome onQuickAction={handleQuickAction} disabled={conversation.isSending} />;
    }
    return <MentorThread conversation={conversation} onRetry={retry} onEditFailed={handleEditFailed} />;
  };

  return (
    <View className="flex-1 bg-n900">
      <StatusBar style="light" />
      <GlowBackdrop />
      {/* Padding behavior on Android too: with edge-to-edge enabled the
          system no longer resizes the window for the keyboard. */}
      <KeyboardAvoidingView behavior="padding" className="flex-1" style={{ paddingTop: insets.top + 16 }}>
        {/* Not while a reply is pending: it would be saved into the new chat. */}
        <MentorHeader
          onNewChat={isReady && hasMessages && !conversation.isSending ? clearConversation : undefined}
        />
        <ProjectContextSelector
          projects={projects}
          status={projectsStatus}
          selectedProject={selectedProject}
          onSelect={selectProject}
          onRetry={() => void refreshProjects()}
        />
        {renderConversation()}
        <MentorComposer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          isSending={conversation.isSending}
          disabled={!isReady}
          inputRef={inputRef}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
