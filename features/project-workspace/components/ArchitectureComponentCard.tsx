import { ArrowRight, Cloud, Database, Server, Smartphone } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { COMPONENT_KIND_LABELS } from "../constants/blueprintLabels";
import { SECTION_ACCENTS } from "../constants/sections";
import type { BlueprintArchitectureComponent, BlueprintComponentKind } from "../types/blueprint";

const accent = SECTION_ACCENTS.architecture;

const KIND_ICONS: Record<BlueprintComponentKind, LucideIcon> = {
  client: Smartphone,
  service: Server,
  datastore: Database,
  external: Cloud,
};

interface ArchitectureComponentCardProps {
  component: BlueprintArchitectureComponent;
  /** Component names by key, to show connections by name. */
  names: ReadonlyMap<string, string>;
}

/** One component: what it is, what it is responsible for and what it calls. */
export function ArchitectureComponentCard({ component, names }: ArchitectureComponentCardProps) {
  const { name, kind, responsibility, connections } = component;
  const Icon = KIND_ICONS[kind];

  return (
    <View className="rounded-lg border border-n600 bg-n700 p-3">
      <View className="flex-row items-center gap-3">
        <View className={`h-8 w-8 items-center justify-center rounded-md ${accent.softBg}`}>
          <Icon size={16} color={accent.color} strokeWidth={2} />
        </View>
        <View className="flex-1">
          <Text className="text-h4 text-white">{name}</Text>
          <Text className="text-caption text-n300">{COMPONENT_KIND_LABELS[kind]}</Text>
        </View>
      </View>
      <Text className="mt-2 text-body-sm text-n100">{responsibility}</Text>

      {connections.length > 0 ? (
        <View className="mt-3 gap-2">
          {connections.map((connection) => {
            // Falls back to the key should a target ever be unknown.
            const target = names.get(connection.target) ?? connection.target;
            return (
              <View
                key={connection.target}
                accessible
                accessibilityLabel={`Calls ${target}: ${connection.interaction}`}
                className="flex-row gap-2"
              >
                <View className="pt-0.5">
                  <ArrowRight size={14} color={accent.color} strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className={`text-body-sm ${accent.text}`}>{target}</Text>
                  <Text className="text-body-sm text-n300">{connection.interaction}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
