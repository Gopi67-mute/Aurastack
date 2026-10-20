import { Globe, Smartphone, TabletSmartphone } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import type { ProjectPlatform } from "../types/createProject";

export interface PlatformOptionConfig {
  value: ProjectPlatform;
  label: string;
  Icon: LucideIcon;
}

export const PLATFORM_OPTIONS: readonly PlatformOptionConfig[] = [
  { value: "android", label: "Android", Icon: Smartphone },
  { value: "ios", label: "iOS", Icon: TabletSmartphone },
  { value: "web", label: "Web", Icon: Globe },
];

export const PLATFORM_LABELS: Record<ProjectPlatform, string> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};
