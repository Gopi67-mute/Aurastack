import { Text, View } from "react-native";

import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintFlow } from "../types/blueprint";

const accent = SECTION_ACCENTS.architecture;

interface ArchitectureFlowCardProps {
  flow: BlueprintFlow;
  /** Component names by key, to label each step by name. */
  names: ReadonlyMap<string, string>;
}

/** One user journey as numbered steps between named components, top to bottom. */
export function ArchitectureFlowCard({ flow, names }: ArchitectureFlowCardProps) {
  const nameOf = (key: string) => names.get(key) ?? key;

  return (
    <View className="rounded-lg border border-n600 bg-n700 p-3">
      <Text accessibilityRole="header" className="text-h4 text-white">
        {flow.name}
      </Text>
      <View className="mt-3">
        {flow.steps.map((step, index) => {
          const isLast = index === flow.steps.length - 1;
          const route = step.actor === step.target
            ? nameOf(step.actor)
            : `${nameOf(step.actor)} → ${nameOf(step.target)}`;
          return (
            <View
              key={`${index}-${step.actor}-${step.target}`}
              accessible
              accessibilityLabel={`Step ${index + 1}: ${route.replace("→", "to")}. ${step.action}`}
              className="flex-row gap-3"
            >
              <View className="items-center">
                <View className={`h-6 w-6 items-center justify-center rounded-full ${accent.fill}`}>
                  <Text className="text-caption text-n900">{index + 1}</Text>
                </View>
                {isLast ? null : <View className={`w-0.5 flex-1 ${accent.line}`} />}
              </View>
              <View className={`flex-1 ${isLast ? "" : "pb-3"}`}>
                <Text className={`text-caption ${accent.text}`}>{route}</Text>
                <Text className="mt-1 text-body-sm text-n100">{step.action}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
