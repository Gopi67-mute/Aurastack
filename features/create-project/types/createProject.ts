import { z } from "zod";

import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "../constants/limits";

export const PROJECT_PLATFORMS = ["android", "ios", "web"] as const;

export type ProjectPlatform = (typeof PROJECT_PLATFORMS)[number];

export const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a project title.")
    .max(TITLE_MAX_LENGTH, `Keep the title under ${TITLE_MAX_LENGTH} characters.`),
  description: z
    .string()
    .trim()
    .min(1, "Describe what you want to build.")
    .max(
      DESCRIPTION_MAX_LENGTH,
      `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters.`
    ),
  platforms: z
    .array(z.enum(PROJECT_PLATFORMS))
    .min(1, "Select at least one target platform."),
});

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

/**
 * Payload for the future POST /projects/generate request. Intentionally
 * minimal: the full backend Project schema does not exist yet.
 */
export type ProjectDraft = CreateProjectFormValues;
