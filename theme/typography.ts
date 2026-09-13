import type { TextStyle } from "react-native";

/**
 * AuraStack typeface.
 *
 * The design reference (reference-material/colorsAndFonts.jpeg) specifies
 * Poppins, but AuraStack's official typeface is Inter — the static weights
 * already bundled at assets/fonts/Inter-*.ttf and loaded in app/_layout.tsx.
 * React Native has no font-weight synthesis, so each weight is its own
 * named family rather than a single family + fontWeight.
 */
export const fontFamily = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
} as const;

type TypeToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
};

function textStyle(family: string, fontSize: number, lineHeightMultiplier: number): TypeToken {
  return {
    fontFamily: family,
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightMultiplier),
  };
}

/** Matches the type ramp in the design reference: size / weight / line-height. */
export const type = {
  h1: textStyle(fontFamily.bold, 32, 1.2), // Page / Screen Title
  h2: textStyle(fontFamily.semibold, 24, 1.3), // Section Title
  h3: textStyle(fontFamily.semibold, 20, 1.3), // Card / Module Title
  h4: textStyle(fontFamily.medium, 16, 1.4), // Subheading
  bodyLarge: textStyle(fontFamily.regular, 16, 1.6), // Important content
  bodyMedium: textStyle(fontFamily.regular, 14, 1.6), // Body text
  bodySmall: textStyle(fontFamily.regular, 12, 1.6), // Supporting text
  caption: textStyle(fontFamily.regular, 11, 1.4), // Labels, meta text
} as const satisfies Record<string, TextStyle>;
