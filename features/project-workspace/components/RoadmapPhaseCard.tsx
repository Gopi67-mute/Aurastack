import { CircleCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { TECH_CATEGORY_LABELS } from "../constants/blueprintLabels";
import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintRoadmapPhase } from "../types/blueprint";
import { Block, BulletList, Disclosure } from "./BlueprintParts";
import { PhaseLearningList } from "./PhaseLearningList";

const accent = SECTION_ACCENTS.roadmap;
const techAccent = SECTION_ACCENTS.techStack;

interface RoadmapPhaseCardProps {
  phase: BlueprintRoadmapPhase;
  initiallyExpanded?: boolean;
}

/**
 * One roadmap phase: its goal up front, then on request why it matters, its
 * tasks, deliverables, acceptance criteria, risks and the curriculum topics
 * it applies. Read-only: the roadmap tracks no progress of its own.
 */
export function RoadmapPhaseCard({ phase, initiallyExpanded = false }: RoadmapPhaseCardProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const { order, title, goal, dependsOn, techCategories, tasks, acceptanceCriteria } = phase;
  const summary = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} · ${acceptanceCriteria.length} ${
    acceptanceCriteria.length === 1 ? "check" : "checks"
  }`;

  return (
    <View className={`rounded-lg border bg-n700 p-3 ${accent.border}`}>
      <Text className={`text-caption ${accent.text}`}>Phase {order}</Text>
      <Text accessibilityRole="header" className="mt-1 text-h4 text-white">
        {title}
      </Text>
      <Text className="mt-1 text-body-sm text-n100">{goal}</Text>

      {dependsOn.length > 0 ? (
        <Text className="mt-2 text-caption text-n300">
          Builds on {dependsOn.map((dependency) => `Phase ${dependency}`).join(", ")}
        </Text>
      ) : null}

      {techCategories.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {techCategories.map((category) => (
            <Text
              key={category}
              className={`rounded-sm px-2 py-1 text-caption ${techAccent.softBg} ${techAccent.text}`}
            >
              {TECH_CATEGORY_LABELS[category]}
            </Text>
          ))}
        </View>
      ) : null}

      <Disclosure
        label={expanded ? "Hide details" : `Details · ${summary}`}
        accessibilityLabel={`${expanded ? "Hide" : "Show"} details of phase ${order}, ${title}`}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        accentText={accent.text}
        accentColor={accent.color}
      />

      {expanded ? <PhaseDetails phase={phase} /> : null}
    </View>
  );
}

function PhaseDetails({ phase }: { phase: BlueprintRoadmapPhase }) {
  const { rationale, tasks, deliverables, acceptanceCriteria, risks, learning } = phase;

  return (
    <View className="mt-2 gap-4">
      <Block title="Why now">
        <Text className="text-body-sm text-n100">{rationale}</Text>
      </Block>
      <Block title="Tasks">
        <BulletList items={tasks} />
      </Block>
      <Block title="Deliverables">
        <BulletList items={deliverables} />
      </Block>
      <Block title="Done when">
        <BulletList
          items={acceptanceCriteria}
          marker={<CircleCheck size={14} color={accent.color} strokeWidth={2} />}
        />
      </Block>
      {risks.length > 0 ? (
        <Block title="Risks & decisions">
          <BulletList items={risks} marker={<TriangleAlert size={14} color={colors.semantic.warning} strokeWidth={2} />} />
        </Block>
      ) : null}
      {learning.length > 0 ? <PhaseLearningList items={learning} /> : null}
    </View>
  );
}
