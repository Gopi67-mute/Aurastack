import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LearningScreenHeader } from "../../features/learning/components/LearningScreenHeader";
import { ProjectLearningPanel } from "../../features/learning/components/ProjectLearningPanel";
import { useProjectLearning } from "../../features/learning/hooks/useProjectLearning";
import { getParam } from "../../features/learning/utils/getParam";

// One project's learning area, reached from the global Learning screen.
// The same panel is shown in the project workspace's Learning tab.
export default function ProjectLearningScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string | string[] }>();
  const projectId = getParam(params.projectId);
  const { project } = useProjectLearning(projectId);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/learning"));

  return (
    <>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1 bg-n900"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LearningScreenHeader title={project?.projectName ?? "Learning"} onBack={goBack} />
        <View className="mt-4">
          {projectId ? <ProjectLearningPanel projectId={projectId} linkToProject /> : null}
        </View>
      </ScrollView>
    </>
  );
}
