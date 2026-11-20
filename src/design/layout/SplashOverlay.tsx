import React, { useEffect, useState } from "react";
import { Image } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "../ThemeProvider";
import { motion, palette } from "../tokens";

/** Misure del marchio: le stesse dello splash nativo (app.config.js: imageWidth 200, immagine 440×480). */
export const SPLASH_MARK_WIDTH = 200;
const SPLASH_MARK_HEIGHT = Math.round((SPLASH_MARK_WIDTH * 480) / 440);
export const SPLASH_HOLD_MS = 120;
export const SPLASH_FADE_MS = 220;

/**
 * Splash → Home senza salti: l'overlay riproduce ESATTAMENTE lo splash nativo (stesso fondo fragola, stesso marchio,
 * stesse misure, stessa posizione), quindi al passaggio dal nativo non si vede nulla cambiare. Poi, dopo un attimo,
 * si dissolve (marchio e fondo insieme, il marchio sale un poco) e la Home è già sotto, con i font caricati.
 * Totale dopo il caricamento: 120 + 220 = 340 ms (< 600). Si vede solo all'avvio a freddo.
 * Con "Meno movimento": solo dissolvenza, il marchio non si sposta.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const { reduceMotion } = useTheme();
  const [gone, setGone] = useState(false);
  const out = useSharedValue(0);

  useEffect(() => {
    if (!ready) return;
    out.set(
      withDelay(
        SPLASH_HOLD_MS,
        withTiming(1, { duration: SPLASH_FADE_MS, easing: motion.easeOut }, (done) => {
          if (done) scheduleOnRN(setGone, true);
        }),
      ),
    );
  }, [ready, out]);

  const coverStyle = useAnimatedStyle(() => ({ opacity: 1 - out.get() }));
  const markStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ scale: 1 + 0.08 * out.get() }],
  }));
  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[
        {
          position: "absolute",
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: palette.strawberry,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5000,
        },
        coverStyle,
      ]}
    >
      <Animated.View style={markStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image
          source={require("../../../assets/splash-mark.png")}
          style={{ width: SPLASH_MARK_WIDTH, height: SPLASH_MARK_HEIGHT }}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  );
}
