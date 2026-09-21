import { Text, View } from "react-native";

interface TechStackListProps {
  technologies: readonly string[];
}

/** Renders a stack that already exists on the project; never derives one. */
export function TechStackList({ technologies }: TechStackListProps) {
  return (
    <View className="flex-row flex-wrap gap-2 py-2">
      {technologies.map((technology) => (
        <View
          key={technology}
          className="rounded-lg border border-n600 bg-n700 px-3 py-2"
        >
          <Text className="text-body-sm text-n100">{technology}</Text>
        </View>
      ))}
    </View>
  );
}
