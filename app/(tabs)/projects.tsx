import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Plus } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProjectListCard } from "../../features/projects/components/ProjectListCard";
import { ProjectsEmpty } from "../../features/projects/components/ProjectsEmpty";
import { useProjects } from "../../features/projects/hooks/useProjects";
import { colors } from "../../theme/colors";

export default function Projects() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projects } = useProjects();

  const goToCreate = () => router.push("/create-project");

  return (
    <>
      <StatusBar style="light" />
      <ScrollView
        className="flex-1 bg-n900"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-h1 text-white">Projects</Text>
        <Text className="mt-1 text-body-md text-n300">
          Build, manage, and track your projects.
        </Text>

        {projects.length > 0 && (
          <Pressable
            onPress={goToCreate}
            accessibilityRole="button"
            accessibilityLabel="Create project"
            className="mt-6 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple px-6 active:opacity-80"
          >
            <Plus size={18} color={colors.neutral.white} strokeWidth={2.5} />
            <Text className="text-h4 text-white">Create Project</Text>
          </Pressable>
        )}

        <View className="mt-6 gap-3">
          {projects.length === 0 ? (
            <ProjectsEmpty onCreatePress={goToCreate} />
          ) : (
            projects.map((project) => (
              <ProjectListCard
                key={project.id}
                project={project}
                onPress={() =>
                  router.push({
                    pathname: "/projects/[projectId]",
                    params: { projectId: project.id },
                  })
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}
