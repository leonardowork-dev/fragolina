import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";

import { Text, useTheme } from "@/design";
import { motion, palette } from "@/design/tokens";
import type { FoodId } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

import { Fruit } from "./Glyphs";

/**
 * Il frutto vola verso la bocca (ease-out), poi morsi con briciole/succo e, ogni tanto, un piccolo "urp".
 * Solo transform e opacity. Con "Meno movimento" non c'è nulla: basta il cambio di faccia del pet.
 * `nonce` cambia a ogni boccone; `size` = lato del pet (la bocca sta a circa il 62% dell'altezza).
 */
const CRUMBS = 7;
const CRUMB_COLORS: Record<FoodId, string> = { mora: palette.strawberryDeep, lampone: palette.strawberry, mirtillo: palette.sky, pesca: palette.butter };

function Crumb({ nonce, i, color, mouthY }: { nonce: number; i: number; color: string; mouthY: number }) {
  const t = useSharedValue(1);
  useEffect(() => {
    t.set(1);
    t.set(withDelay(420, withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 520, easing: motion.easeOut }))));
  }, [nonce, t]);
  const dx = (i - (CRUMBS - 1) / 2) * 16;
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return { opacity: p >= 1 ? 0 : 1 - p, transform: [{ translateX: dx * p * 1.6 }, { translateY: -14 * Math.sin(p * Math.PI) + 46 * p * p }, { scale: 1 - 0.4 * p }] };
  });
  return <Animated.View style={[{ position: "absolute", top: mouthY, left: "50%", marginLeft: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: color, borderWidth: 1.5, borderColor: palette.ink }, style]} />;
}

export function EatFx({ nonce, food, size, burp }: { nonce: number; food: FoodId; size: number; burp: boolean }) {
  const { reduceMotion } = useTheme();
  const fly = useSharedValue(1);
  const urp = useSharedValue(0);
  const mouthY = (size * 250) / 220 * 0.62;
  useEffect(() => {
    if (reduceMotion || nonce === 0) return;
    fly.set(0);
    fly.set(withTiming(1, { duration: 400, easing: motion.easeOut }));
    urp.set(0);
    if (burp) urp.set(withDelay(1100, withSequence(withTiming(1, { duration: 140, easing: motion.easeOut }), withDelay(700, withTiming(0, { duration: 260, easing: motion.easeOut })))));
  }, [nonce, reduceMotion, burp, fly, urp]);
  const fruit = useAnimatedStyle(() => {
    const p = fly.get();
    return { opacity: p >= 1 ? 0 : 1, transform: [{ translateY: (1 - p) * 150 }, { translateX: (1 - p) * -34 }, { scale: 1 - 0.55 * p }, { rotate: `${(1 - p) * -40}deg` }] };
  });
  const urpStyle = useAnimatedStyle(() => ({ opacity: urp.get(), transform: [{ translateY: -10 * urp.get() }] }));
  if (reduceMotion || nonce === 0) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ position: "absolute", top: mouthY - 22, left: "50%", marginLeft: -22 }, fruit]}>
        <Fruit id={food} size={44} />
      </Animated.View>
      {Array.from({ length: CRUMBS }, (_, i) => <Crumb key={i} nonce={nonce} i={i} color={CRUMB_COLORS[food]} mouthY={mouthY} />)}
      {burp ? (
        <Animated.View style={[{ position: "absolute", top: mouthY - 10, left: "58%" }, urpStyle]}>
          <Text variant="bodyStrong">{S.pet.burp}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
