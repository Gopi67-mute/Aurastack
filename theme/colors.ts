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

export const colors = {
  brand,
  semantic,
  neutral,
} as const;
