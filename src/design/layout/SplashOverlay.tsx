import React, { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Mascot } from "../mascot/Mascot";
import { useTheme } from "../ThemeProvider";
import { palette } from "../tokens";

/**
 * Splash animato: sul fondo fragola la mascotte compare da scala 0.9 con opacità (mai da zero), resta un attimo e
 * l'overlay si dissolve. Si vede solo all'avvio a freddo. Con "Meno movimento": solo dissolvenza.
 */
export function SplashOverlay({ ready }: { ready: boolean }) {
  const { reduceMotion } = useTheme();
  const [gone, setGone] = useState(false);
  const pop = useSharedValue(0);
  const cover = useSharedValue(1);

  useEffect(() => {
    if (!ready) return;
    pop.set(withTiming(1, { duration: 320, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    cover.set(withDelay(620, withTiming(0, { duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1) }, (done) => {
      if (done) scheduleOnRN(setGone, true);
    })));
  }, [ready, pop, cover]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: reduceMotion ? [] : [{ scale: 0.9 + 0.1 * pop.get() }],
  }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.get() }));
  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: palette.strawberry, alignItems: "center", justifyContent: "center", zIndex: 5000 }, coverStyle]}
    >
      <Animated.View style={markStyle}>
        <View accessibilityElementsHidden>
          <Mascot size={150} tappable={false} bob={false} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}
