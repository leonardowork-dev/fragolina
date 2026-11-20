import React, { useEffect } from "react";
import { type DimensionValue } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../ThemeProvider";
import { motion, outline, radius as radii } from "../tokens";

/** Il scheletro compare solo se l'attesa dura più di così: dati arrivati prima = niente sfarfallio. */
export const SKELETON_DELAY_MS = 150;
/** Dissolvenza del contenuto che prende il posto dello scheletro (easeOut, ≤ 200 ms). */
export const REVEAL_MS = 180;
const REVEAL_WINDOW_MS = 400;
let skeletonGoneAt = -Infinity;

/**
 * Skeleton: forma piatta da adesivo (blush + contorno) che pulsa in opacità. Nessuno shimmer a gradiente.
 * Occupa subito il suo spazio (nessun salto di layout) ma resta invisibile per i primi 150 ms: se i dati arrivano
 * prima non si vede mai (niente sfarfallio). Con "Meno movimento" resta ferma.
 * Uso: <Skeleton width="60%" height={28} />
 */
export function Skeleton({
  width = "100%",
  height = 24,
  radius = radii.md,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const { colors, reduceMotion } = useTheme();
  const k = useSharedValue(1);
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.set(
      withDelay(SKELETON_DELAY_MS, withTiming(1, { duration: 120, easing: motion.easeOut })),
    );
    let visible = false;
    const t = setTimeout(() => (visible = true), SKELETON_DELAY_MS);
    return () => {
      clearTimeout(t);
      // Se si era visto, il contenuto che arriva subito dopo (Reveal) si dissolve invece di scattare.
      if (visible) skeletonGoneAt = Date.now();
    };
  }, [shown]);
  useEffect(() => {
    if (reduceMotion) {
      k.set(1);
      return;
    }
    k.set(
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 700, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
          withTiming(1, { duration: 700, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        ),
        -1,
      ),
    );
  }, [reduceMotion, k]);
  const style = useAnimatedStyle(() => ({ opacity: k.get() * shown.get() }));
  return (
    <Animated.View
      accessibilityElementsHidden
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.blush,
          borderWidth: outline.width,
          borderColor: colors.outline,
        },
        style,
      ]}
    />
  );
}

/**
 * Contenuto che prende il posto di uno scheletro: si dissolve in 180 ms (easeOut). Se non c'era nessuno scheletro
 * visibile (dati arrivati subito, o semplice cambio di schermata) compare subito, senza animazione.
 * Con "Meno movimento" compare sempre subito.
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useTheme();
  const [fade] = React.useState(
    () => !reduceMotion && Date.now() - skeletonGoneAt < REVEAL_WINDOW_MS,
  );
  const o = useSharedValue(fade ? 0 : 1);
  useEffect(() => {
    if (fade) o.set(withTiming(1, { duration: REVEAL_MS, easing: motion.easeOut }));
  }, [fade, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
