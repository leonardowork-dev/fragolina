import React, { useEffect } from "react";
import { type DimensionValue } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { useTheme } from "../ThemeProvider";
import { outline, radius as radii } from "../tokens";

/**
 * Skeleton: forma piatta da adesivo (blush + contorno) che pulsa in opacità. Nessuno shimmer a gradiente.
 * Con "Meno movimento" resta ferma. Uso: <Skeleton width="60%" height={28} />
 */
export function Skeleton({ width = "100%", height = 24, radius = radii.md }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { colors, reduceMotion } = useTheme();
  const k = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      k.set(1);
      return;
    }
    k.set(withRepeat(withSequence(withTiming(0.55, { duration: 700, easing: Easing.bezier(0.45, 0, 0.55, 1) }), withTiming(1, { duration: 700, easing: Easing.bezier(0.45, 0, 0.55, 1) })), -1));
  }, [reduceMotion, k]);
  const style = useAnimatedStyle(() => ({ opacity: k.get() }));
  return (
    <Animated.View
      accessibilityElementsHidden
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.blush, borderWidth: outline.width, borderColor: colors.outline }, style]}
    />
  );
}
