import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ChevronLeft, RotateCcw, Sparkles } from "lucide-react-native";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CreateProjectFields } from "../features/create-project/components/CreateProjectFields";
import { DraftSavedView } from "../features/create-project/components/DraftSavedView";
import { useCreateProjectForm } from "../features/create-project/hooks/useCreateProjectForm";
import { colors } from "../theme/colors";

// Full-screen flow (outside the tabs). Generate is a local mock for now; see
// features/create-project/services/submitProjectDraft.ts.
export default function CreateProject() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { form, submit, resetForm, startNewProject, savedDraft, submitError } =
    useCreateProjectForm();

  const isSubmitting = form.formState.isSubmitting;

  return (
    <>
      <StatusBar style="light" />
      {/* Padding behavior is needed on Android too: with edge-to-edge enabled
          the system no longer resizes the window for the keyboard. */}
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 bg-n900"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="px-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            className="mb-4 h-10 w-10 items-center justify-center rounded-full border border-n600 bg-n800 active:opacity-80"
          >
            <ChevronLeft size={20} color={colors.neutral.white} />
          </Pressable>
        </View>

        {savedDraft ? (
          <View className="flex-1 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
            <DraftSavedView
              draft={savedDraft}
              onCreateAnother={startNewProject}
              // Explicit destination: works wherever Create was opened from.
              onDone={() => router.dismissTo("/projects")}
            />
          </View>
        ) : (
          <>
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-h1 text-white">
                Create <Text className="text-ai-accent">New Project</Text>
              </Text>
              <Text className="mb-6 mt-1 text-body-lg text-n300">
                Tell us about your idea and we&apos;ll help turn it into a structured project.
              </Text>
              <CreateProjectFields form={form} />
              {submitError ? (
                <Text className="mt-4 text-body-sm text-error text-center">{submitError}</Text>
              ) : null}
            </ScrollView>

            <View
              className="flex-row gap-3 px-4 pt-3"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <Pressable
                onPress={resetForm}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Reset form"
                className="min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-n600 active:opacity-80"
              >
                <RotateCcw size={18} color={colors.neutral.white} />
                <Text className="text-h4 text-white">Reset</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Generate project"
                className={`min-h-14 flex-[1.4] flex-row items-center justify-center gap-2 rounded-lg bg-aura-purple active:opacity-80 ${
                  isSubmitting ? "opacity-60" : ""
                }`}
              >
                <Sparkles size={18} color={colors.neutral.white} />
                <Text className="text-h4 text-white">Generate</Text>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
