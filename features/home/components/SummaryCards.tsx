import { BookOpen, Flame, FolderOpen } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "../../../theme/colors";
import type { HomeData } from "../types/home";
import { getLearningPercent } from "../utils/getLearningPercent";
import { SummaryCard } from "./SummaryCard";

interface SummaryCardsProps {
  projects: HomeData["projects"];
  learning: HomeData["learning"];
  momentum: HomeData["momentum"];
  onProjectsPress: () => void;
  onLearningPress: () => void;
  onMomentumPress: () => void;
}

export function SummaryCards({
  projects,
  learning,
  momentum,
  onProjectsPress,
  onLearningPress,
  onMomentumPress,
}: SummaryCardsProps) {
  const learningPercent = getLearningPercent(
    learning.completedTopics,
    learning.totalTopics,
  );

  return (
    <View className="flex-row gap-3">
      <SummaryCard
        icon={FolderOpen}
        iconColor={colors.brand.auraIndigo}
        iconTileClassName="bg-aura-indigo/15"
        label="Projects"
        value={String(projects.total)}
        caption={`${projects.active} active`}
        onPress={onProjectsPress}
      />
      <SummaryCard
        icon={BookOpen}
        iconColor={colors.brand.auraPurple}
        iconTileClassName="bg-aura-purple/15"
        label="Learning progress"
        value={`${learning.completedTopics} / ${learning.totalTopics}`}
        caption={`${learningPercent}% complete`}
        onPress={onLearningPress}
      />
      <SummaryCard
        icon={Flame}
        iconColor={colors.semantic.warning}
        iconTileClassName="bg-warning/15"
        label="Momentum"
        value={String(momentum.streakDays)}
        unit={momentum.streakDays === 1 ? "day" : "days"}
        caption={`${momentum.tasksDone} tasks done`}
        onPress={onMomentumPress}
      />
    </View>
  );
}
