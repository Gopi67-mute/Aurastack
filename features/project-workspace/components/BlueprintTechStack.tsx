import { Info } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import type { BlueprintTechChoice } from "../types/blueprint";
import { BulletList, Subheading } from "./BlueprintParts";
import { TechChoiceCard } from "./TechChoiceCard";

interface BlueprintTechStackProps {
  summary: string;
  assumptions: readonly string[];
  technologies: readonly BlueprintTechChoice[];
}

/**
 * The blueprint's recommended stack with its rationale and alternatives; not
 * the user-entered Project.techStack. Leads with the blueprint summary and
 * any assumptions the recommendations rest on.
 */
export function BlueprintTechStack({ summary, assumptions, technologies }: BlueprintTechStackProps) {
  return (
    <View className="gap-3 pt-4">
      {summary ? <Text className="text-body-md text-n100">{summary}</Text> : null}

      {assumptions.length > 0 ? (
        <View className="gap-2 rounded-lg border border-n600 bg-n800 p-3">
          <View className="flex-row items-center gap-2">
            <Info size={14} color={colors.neutral.n300} strokeWidth={2} />
            <Subheading title="Assumptions" />
          </View>
          <BulletList items={assumptions} />
        </View>
      ) : null}

      {technologies.length === 0 ? (
        <Text className="py-2 text-body-md text-n300">
          No technologies were recommended for this project.
        </Text>
      ) : (
        technologies.map((technology) => (
          <TechChoiceCard key={`${technology.category}-${technology.name}`} technology={technology} />
        ))
      )}
    </View>
  );
}
