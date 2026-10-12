import { Text, View } from "react-native";

import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintRoadmapPhase } from "../types/blueprint";
import { RoadmapPhaseCard } from "./RoadmapPhaseCard";

const accent = SECTION_ACCENTS.roadmap;

interface BlueprintRoadmapProps {
  phases: readonly BlueprintRoadmapPhase[];
}

/**
 * The development roadmap as a timeline, in phase order. The first phase
 * opens expanded; each phase links the curriculum topics it applies.
 */
export function BlueprintRoadmap({ phases }: BlueprintRoadmapProps) {
  if (phases.length === 0) {
    return <Text className="py-2 text-body-md text-n300">No roadmap phases were planned.</Text>;
  }

  const ordered = [...phases].sort((a, b) => a.order - b.order);
  const taskCount = ordered.reduce((total, phase) => total + phase.tasks.length, 0);

  return (
    <View className="pt-4">
      <Text className="mb-4 text-body-sm text-n300">
        {ordered.length} phases · {taskCount} tasks, ordered by what each phase depends on.
      </Text>

      {ordered.map((phase, index) => {
        const isLast = index === ordered.length - 1;
        return (
          <View key={`${phase.order}-${phase.title}`} className="flex-row gap-3">
            <View className="items-center">
              <View
                importantForAccessibility="no-hide-descendants"
                className={`h-8 w-8 items-center justify-center rounded-full ${accent.fill}`}
              >
                <Text className="text-body-sm text-n900">{phase.order}</Text>
              </View>
              {isLast ? null : <View className={`w-0.5 flex-1 ${accent.line}`} />}
            </View>
            <View className={`flex-1 ${isLast ? "" : "pb-4"}`}>
              <RoadmapPhaseCard phase={phase} initiallyExpanded={index === 0} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
