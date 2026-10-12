/**
 * AuraStack brand color tokens.
 * Source: reference-material/colorsAndFonts.jpeg
 *
 * Mirrored as NativeWind utilities in ../global.css (@theme block) so the
 * same values are usable both via className and in plain style objects.
 */

export const brand = {
  auraPurple: "#7C3AED",
  auraIndigo: "#6366F1",
  auraBlue: "#00D1FF",
  auraTeal: "#14F195",
} as const;

export const semantic = {
  success: "#22C55E",
  warning: "#F59E0B",
  info: "#0EA5E9",
  error: "#EF4444",
  aiAccent: "#A855F7",
} as const;

export const neutral = {
  n900: "#05070D",
  n800: "#0B0F19",
  n700: "#111827",
  n600: "#1F2951",
  n300: "#9CA3AF",
  n100: "#E5E7EB",
  white: "#FFFFFF",
} as const;

/**
 * Project workspace section accents (Tech Stack, Roadmap, Architecture,
 * Learning). Each is at least 4.5:1 against n700 and n800, so it reads as
 * text, icon or border on the app's dark surfaces; tints use opacity
 * modifiers (e.g. bg-section-tech/10). They identify a section only and
 * never stand in for the semantic success, warning or error colors.
 */
export const section = {
  techStack: "#60A5FA",
  roadmap: "#FBBF24",
  architecture: "#34D399",
  learning: "#A78BFA",
} as const;

export const colors = {
  brand,
  semantic,
  neutral,
  section,
} as const;
