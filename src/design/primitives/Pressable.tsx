import React, { useCallback } from "react";
import {
  type GestureResponderEvent,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  type AnimatedStyle,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { haptics } from "@/lib/haptics";

import { useTheme } from "../ThemeProvider";
import { motion, shadowOffset } from "../tokens";

export type HapticKind = "tick" | "light" | "medium" | "success" | "none";

type Options = {
  offset?: number;
  pressScale?: number;
  haptic?: HapticKind;
  onPress?: (e: GestureResponderEvent) => void;
};

/**
 * Comportamento "adesivo" di pressione: risponde al press-IN (traslazione dentro la propria ombra +
 * scala 0.97 in ~110ms), conferma al press-OUT con una molla. Un solo shared value `p` (0→1) pilota
 * transform; nessun setState. Con "Meno movimento" resta solo un lieve calo di opacità.
 * Restituisce lo stile animato per la FACCIA e le props da passare al Pressable.
 */
export function usePressFeedback({
  offset = shadowOffset.md,
  pressScale = motion.pressScale,
  haptic = "none",
  onPress,
}: Options) {
  const { reduceMotion } = useTheme();
  const p = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => {
    const v = p.get();
    return {
      transform: reduceMotion
        ? []
        : [{ translateX: offset * v }, { translateY: offset * v }, { scale: 1 - (1 - pressScale) * v }],
      opacity: reduceMotion ? 1 - 0.18 * v : 1,
    };
  });

  const pressProps = {
    onPressIn: () => p.set(withTiming(1, { duration: motion.duration.press, easing: motion.easeOut })),
    onPressOut: () => p.set(withSpring(0, motion.springSnappy)),
    onPress: useCallback(
      (e: GestureResponderEvent) => {
        if (haptic !== "none") haptics[haptic]();
        onPress?.(e);
      },
      [haptic, onPress],
    ),
  };
  return { faceStyle, pressProps };
}

export type StickerPressableProps = Omit<RNPressableProps, "style" | "children"> & {
  children: React.ReactNode;
  haptic?: HapticKind;
  offset?: number;
  pressScale?: number;
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
};

/**
 * Pressable generico con lo stesso comportamento (per elementi senza ombra: tab, link, ghost).
 * Uso: <StickerPressable onPress={...} haptic="light">…</StickerPressable>
 */
export function StickerPressable({
  children,
  onPress,
  haptic,
  offset = 0,
  pressScale,
  style,
  hitSlop = 6,
  accessibilityRole = "button",
  ...rest
}: StickerPressableProps) {
  const { faceStyle, pressProps } = usePressFeedback({ offset, pressScale, haptic, onPress: onPress ?? undefined });
  return (
    <RNPressable accessibilityRole={accessibilityRole} hitSlop={hitSlop} {...rest} {...pressProps}>
      <Animated.View style={[faceStyle, style]}>{children}</Animated.View>
    </RNPressable>
  );
}
