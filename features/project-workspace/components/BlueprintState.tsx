import { Clock, RefreshCw, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import { colors } from "../../../theme/colors";
import { SECTION_ACCENTS } from "../constants/sections";
import type {
  BlueprintLoadStatus,
  BlueprintSectionKey,
  ProjectBlueprintContent,
} from "../types/blueprint";
import { BlueprintArchitecture } from "./BlueprintArchitecture";
import { BlueprintRoadmap } from "./BlueprintRoadmap";
import { BlueprintTechStack } from "./BlueprintTechStack";

const LOAD_ERROR = "Couldn't load your blueprint.";

interface BlueprintStateProps {
  section: BlueprintSectionKey;
  status: BlueprintLoadStatus;
  blueprint: ProjectBlueprintContent | null;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => void;
}

/**
 * Loading, generating, failure and error states of a project's blueprint;
 * renders the requested section once it is ready. Holds no requests itself:
 * the state comes from useProjectBlueprint.
 */
export function BlueprintState({ section, status, blueprint, error, onRetry, onRefresh }: BlueprintStateProps) {
  const accent = SECTION_ACCENTS[section];

  if (status === "ready" && blueprint) {
    if (section === "techStack") {
      return (
        <BlueprintTechStack
          summary={blueprint.summary}
          assumptions={blueprint.assumptions}
          technologies={blueprint.techStack}
        />
      );
    }
    if (section === "architecture") return <BlueprintArchitecture architecture={blueprint.architecture} />;
    return <BlueprintRoadmap phases={blueprint.roadmap} />;
  }

  if (status === "generating") {
    return (
      <Notice
        iconBackground={accent.softBg}
        icon={<ActivityIndicator color={accent.color} />}
        title="Designing your blueprint…"
        message="Your tech stack, architecture and roadmap will appear here in a moment."
      />
    );
  }

  if (status === "failed") {
    return (
      <Notice
        iconBackground="bg-error/15"
        icon={<TriangleAlert size={28} color={colors.semantic.error} strokeWidth={1.75} />}
        title="Couldn't generate your blueprint"
        message="Something went wrong while designing it. Your project and learning plan are unaffected."
      >
        <ActionButton label="Try Again" accessibilityLabel="Try generating the blueprint again" onPress={onRetry} />
      </Notice>
    );
  }

  if (status === "timedOut") {
    return (
      <Notice
        iconBackground={accent.softBg}
        icon={<Clock size={28} color={accent.color} strokeWidth={1.75} />}
        title="Still working on it"
        message="Blueprint generation is taking longer than expected."
      >
        <ActionButton label="Refresh" accessibilityLabel="Refresh the blueprint" onPress={onRefresh} />
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <View className="pt-4">
        <ErrorState message={error ?? LOAD_ERROR} onRetry={onRetry} />
      </View>
    );
  }

  // "loading", and the brief "idle" before following starts.
  return (
    <View className="pt-4">
      <LoadingState label="blueprint" />
    </View>
  );
}

interface NoticeProps {
  icon: ReactNode;
  /** NativeWind background class of the icon tile. */
  iconBackground: string;
  title: string;
  message: string;
  children?: ReactNode;
}

function Notice({ icon, iconBackground, title, message, children }: NoticeProps) {
  return (
    <View className="items-center px-4 py-8">
      <View
        accessible
        accessibilityLabel={`${title}. ${message}`}
        className="items-center"
      >
        <View className={`h-16 w-16 items-center justify-center rounded-xl ${iconBackground}`}>{icon}</View>
        <Text className="mt-4 text-center text-h4 text-white">{title}</Text>
        <Text className="mt-2 text-center text-body-sm text-n300">{message}</Text>
      </View>
      {children}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

function ActionButton({ label, accessibilityLabel, onPress }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="mt-4 min-h-12 flex-row items-center justify-center gap-2 self-stretch rounded-lg bg-aura-purple active:opacity-80"
    >
      <RefreshCw size={16} color={colors.neutral.white} strokeWidth={2.5} />
      <Text className="text-body-md text-white">{label}</Text>
    </Pressable>
  );
}
