import { Image } from "expo-image";
import { Bug, Compass, Lightbulb, Network, type LucideIcon } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import { images } from "../../../constants/images";
import type { QuickActionKey } from "../types/mentor";
import { QuickActionCard } from "./QuickActionCard";

/** assets/images/3rd-screen.png is 1399×1124. */
const FEATURES_IMAGE_ASPECT_RATIO = 1399 / 1124;

interface QuickAction {
  key: QuickActionKey;
  title: string;
  description: string;
  Icon: LucideIcon;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { key: "architecture", title: "Explain My Architecture", description: "How the parts fit together", Icon: Network },
  { key: "debug", title: "Help Me Debug", description: "Reason through an error", Icon: Bug },
  { key: "next", title: "What Should I Build Next?", description: "Pick the next step", Icon: Compass },
  { key: "concept", title: "Explain a Concept", description: "Clear, with an example", Icon: Lightbulb },
];

interface MentorWelcomeProps {
  onQuickAction: (key: QuickActionKey) => void;
  disabled: boolean;
}

/** The empty state before the selected context's first message. */
export function MentorWelcome({ onQuickAction, disabled }: MentorWelcomeProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center rounded-xl border border-n600 bg-n800/80 px-6 py-6">
        <Image
          source={images.auraBotFeatures}
          style={{ width: "100%", aspectRatio: FEATURES_IMAGE_ASPECT_RATIO }}
          contentFit="contain"
          accessibilityLabel="Aura waving among its features: AI mentoring, tech stack suggestions, documentation, architecture design, learning roadmap and feature breakdown"
        />
        <Text className="mt-3 text-h3 text-white text-center">Hi, I&apos;m Aura</Text>
        <Text className="mt-2 text-body-md text-n300 text-center">
          Ask about architecture, debugging, concepts or what to build next. Pick a project above
          and I&apos;ll ground my answers in its blueprint and learning progress.
        </Text>
        <Text className="mt-3 text-caption text-n300 text-center">
          I can&apos;t run your code or see your files, so share the snippets and errors you&apos;re
          working with.
        </Text>
      </View>

      <Text className="mt-6 mb-3 text-h4 text-white">Get started</Text>
      <View className="flex-row flex-wrap gap-3">
        {QUICK_ACTIONS.map(({ key, title, description, Icon }) => (
          <QuickActionCard
            key={key}
            title={title}
            description={description}
            Icon={Icon}
            disabled={disabled}
            onPress={() => onQuickAction(key)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
