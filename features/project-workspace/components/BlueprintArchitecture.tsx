import { TriangleAlert } from "lucide-react-native";
import { Text, View } from "react-native";

import { colors } from "../../../theme/colors";
import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintArchitecture as Architecture } from "../types/blueprint";
import { ArchitectureComponentCard } from "./ArchitectureComponentCard";
import { ArchitectureFlowCard } from "./ArchitectureFlowCard";
import { Block, BulletList } from "./BlueprintParts";

const accent = SECTION_ACCENTS.architecture;

interface BlueprintArchitectureProps {
  architecture: Architecture;
}

/**
 * Read-only architecture: style and overview, the components and what they
 * call, the key data flows, failure handling and trade-offs. Structured
 * cards rather than a diagram, so it stays readable on narrow screens.
 */
export function BlueprintArchitecture({ architecture }: BlueprintArchitectureProps) {
  const { style, overview, components, flows, failureModes, tradeoffs } = architecture;
  // Connections and flow steps are stored as component keys; show their names.
  const names = new Map(components.map((component) => [component.key, component.name]));

  return (
    <View className="gap-6 pt-4">
      <View className={`rounded-lg border p-3 ${accent.border} ${accent.softBg}`}>
        <Text className={`text-caption ${accent.text}`}>Architecture style</Text>
        <Text className="mt-1 text-h4 text-white">{style}</Text>
        <Text className="mt-2 text-body-md text-n100">{overview}</Text>
      </View>

      <Block title="Components">
        {components.length === 0 ? (
          <Text className="text-body-md text-n300">No components were described.</Text>
        ) : (
          components.map((component) => (
            <ArchitectureComponentCard key={component.key} component={component} names={names} />
          ))
        )}
      </Block>

      <Block title="Data Flows">
        {flows.length === 0 ? (
          <Text className="text-body-md text-n300">No data flow was described.</Text>
        ) : (
          flows.map((flow) => <ArchitectureFlowCard key={flow.name} flow={flow} names={names} />)
        )}
      </Block>

      {failureModes.length > 0 ? (
        <Block title="Failure Handling">
          {failureModes.map((mode) => (
            <View key={mode.scenario} className="flex-row gap-3 rounded-lg border border-n600 bg-n700 p-3">
              <View className="pt-0.5">
                <TriangleAlert size={16} color={colors.semantic.warning} strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-body-md text-white">{mode.scenario}</Text>
                <Text className="mt-1 text-body-sm text-n300">{mode.handling}</Text>
              </View>
            </View>
          ))}
        </Block>
      ) : null}

      {tradeoffs.length > 0 ? (
        <Block title="Trade-offs">
          <BulletList items={tradeoffs} />
        </Block>
      ) : null}
    </View>
  );
}
