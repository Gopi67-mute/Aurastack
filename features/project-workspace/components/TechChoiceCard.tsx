import { BadgeCheck } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { TECH_CATEGORY_LABELS } from "../constants/blueprintLabels";
import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintTechChoice } from "../types/blueprint";
import { Disclosure, Subheading } from "./BlueprintParts";

const accent = SECTION_ACCENTS.techStack;

interface TechChoiceCardProps {
  technology: BlueprintTechChoice;
}

/**
 * One recommended technology: its category, role and why it fits. Its
 * alternatives and integration notes are shown on request.
 */
export function TechChoiceCard({ technology }: TechChoiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { category, name, purpose, rationale, alternatives, integrationNotes } = technology;
  const hasDetails = alternatives.length > 0 || Boolean(integrationNotes);
  const detailsLabel =
    alternatives.length > 0 ? `Alternatives & trade-offs (${alternatives.length})` : "Integration notes";

  return (
    <View className={`rounded-lg border bg-n700 p-3 ${accent.border}`}>
      <View className="flex-row items-center justify-between gap-2">
        <Text className={`rounded-sm px-2 py-1 text-caption ${accent.softBg} ${accent.text}`}>
          {TECH_CATEGORY_LABELS[category]}
        </Text>
        <View className="flex-row items-center gap-1">
          <BadgeCheck size={14} color={accent.color} strokeWidth={2} />
          <Text className={`text-caption ${accent.text}`}>Recommended</Text>
        </View>
      </View>

      <Text className="mt-2 text-h4 text-white">{name}</Text>
      <Text className="mt-1 text-body-sm text-n100">{purpose}</Text>

      <View className="mt-3 gap-1">
        <Subheading title="Why it fits" />
        <Text className="text-body-sm text-n300">{rationale}</Text>
      </View>

      {hasDetails ? (
        <Disclosure
          label={detailsLabel}
          accessibilityLabel={`${expanded ? "Hide" : "Show"} ${detailsLabel.toLowerCase()} for ${name}`}
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
          accentText={accent.text}
          accentColor={accent.color}
        />
      ) : null}

      {expanded ? (
        <View className="mt-2 gap-2">
          {alternatives.map((alternative) => (
            <View key={alternative.name} className="rounded-md border border-n600 bg-n800 p-3">
              <Text className="text-caption text-n300">Alternative</Text>
              <Text className="mt-1 text-body-md text-white">{alternative.name}</Text>
              <Text className="mt-1 text-body-sm text-n300">{alternative.tradeoff}</Text>
            </View>
          ))}
          {integrationNotes ? (
            <View className="gap-1">
              <Subheading title="Integration" />
              <Text className="text-body-sm text-n100">{integrationNotes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
