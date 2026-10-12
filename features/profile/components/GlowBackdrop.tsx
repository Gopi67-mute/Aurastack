import { StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "../../../theme/colors";

const GLOW_HEIGHT = 360;
const GLOW_OPACITY = 0.22;

/** Soft purple-to-blue glow behind the top of the screen. Decorative only. */
export function GlowBackdrop() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.glow}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="profileGlowPurple" cx="85%" cy="0%" r="75%">
            <Stop offset="0" stopColor={colors.brand.auraPurple} stopOpacity={GLOW_OPACITY} />
            <Stop offset="1" stopColor={colors.brand.auraPurple} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="profileGlowBlue" cx="0%" cy="30%" r="60%">
            <Stop offset="0" stopColor={colors.brand.auraIndigo} stopOpacity={GLOW_OPACITY / 2} />
            <Stop offset="1" stopColor={colors.brand.auraIndigo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#profileGlowPurple)" />
        <Rect width="100%" height="100%" fill="url(#profileGlowBlue)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: GLOW_HEIGHT },
});
