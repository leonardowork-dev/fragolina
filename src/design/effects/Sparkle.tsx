import React, { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../ThemeProvider";
import { palette } from "../tokens";

/**
 * Sparkle: stellina a quattro punte che scintilla (scala 0.9→1.1 + opacità). Decorativa e rara:
 * usarla in pochi punti. Con "Meno movimento" resta ferma. Uso: <Sparkle size={18} delay={400} />
 */
const STAR = "M12 1.5 L14.7 9.3 L22.5 12 L14.7 14.7 L12 22.5 L9.3 14.7 L1.5 12 L9.3 9.3 Z";

export function Sparkle({
  size = 20,
  delay = 0,
  color = palette.butter,
}: {
  size?: number;
  delay?: number;
  color?: string;
}) {
  const { reduceMotion } = useTheme();
  const k = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      k.set(1);
      return;
    }
    k.set(
      withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 500, easing: Easing.bezier(0.23, 1, 0.32, 1) }),
            withTiming(0.15, { duration: 700, easing: Easing.bezier(0.77, 0, 0.175, 1) }),
          ),
          -1,
        ),
      ),
    );
  }, [reduceMotion, delay, k]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + 0.75 * k.get(),
    transform: [{ scale: 0.9 + 0.2 * k.get() }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={STAR} fill={color} stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}
