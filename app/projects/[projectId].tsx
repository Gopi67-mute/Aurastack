import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { ProjectNotFound } from "../../features/project-workspace/components/ProjectNotFound";
import { ProjectSummaryCard } from "../../features/project-workspace/components/ProjectSummaryCard";
import { WorkspaceHeader } from "../../features/project-workspace/components/WorkspaceHeader";
import { WorkspaceSectionPanel } from "../../features/project-workspace/components/WorkspaceSectionPanel";
import { WorkspaceTabs } from "../../features/project-workspace/components/WorkspaceTabs";
import { DEFAULT_WORKSPACE_SECTION } from "../../features/project-workspace/constants/sections";
import { useProjectById } from "../../features/project-workspace/hooks/useProjectById";
import type { WorkspaceSectionKey } from "../../features/project-workspace/types/workspace";

// Full-screen project detail route (outside the tabs), like /create-project.
export default function ProjectWorkspace() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string | string[] }>();
  const id = Array.isArray(projectId) ? projectId[0] : projectId;
  const { project, status, error, refresh } = useProjectById(id);
  const [section, setSection] = useState<WorkspaceSectionKey>(DEFAULT_WORKSPACE_SECTION);

  // Back pops to Projects normally; falls back there when opened directly.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/projects"));

  const renderBody = () => {
    // "Not found" is only trustworthy once the project list has actually loaded.
    if (!project && (status === "idle" || status === "loading")) {
      return (
        <View className="flex-1 justify-center px-4">
          <LoadingState label="project" />
        </View>
      );
    }
    if (!project && status === "error") {
      return (
        <View className="flex-1 justify-center px-4">
          <ErrorState message={error ?? "Couldn't load this project."} onRetry={refresh} />
        </View>
      );
    }
    if (!project) return <ProjectNotFound onBackToProjects={() => router.replace("/projects")} />;

    return (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ProjectSummaryCard project={project} />
        <WorkspaceTabs active={section} onChange={setSection} />
        <WorkspaceSectionPanel project={project} section={section} />
      </ScrollView>
    );
  };

  return (
    <>
      <StatusBar style="light" />
      <View className="flex-1 bg-n900" style={{ paddingTop: insets.top + 16 }}>
        <WorkspaceHeader title={project?.name} onBack={goBack} />
        {renderBody()}
      </View>
    </>
  );
}
