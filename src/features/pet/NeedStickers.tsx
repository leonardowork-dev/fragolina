import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Sticker, Text, useTheme } from "@/design";
import { motion, palette } from "@/design/tokens";
import { LOW_NEED, NEED_MAX, type NeedId, type Needs } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

import { Glyph } from "./Glyphs";

/**
 * I tre bisogni come tre adesivi diversi (non tre barre uguali): una frutta che si svuota, un cuore, una luna.
 * Colore, forma, inclinazione e altezza diversi. A basso livello compare un pallino fragola e la parola cambia.
 * Il livello cambia con uno "scatto" (molla) quando sale; mai animazioni continue.
 */
const LOOK: Record<NeedId, { fill: string; glyph: "food" | "love" | "energy"; level: string; tilt: number; lift: number; w: string }> = {
  food: { fill: palette.butter, glyph: "food", level: palette.strawberry, tilt: -2, lift: 0, w: "36%" },
  love: { fill: palette.blush, glyph: "love", level: palette.strawberry, tilt: 1.5, lift: 14, w: "30%" },
  energy: { fill: palette.sky, glyph: "energy", level: palette.butter, tilt: -1, lift: 4, w: "30%" },
};

const levelOf = (v: number) => (v < LOW_NEED ? "low" : v < 650 ? "mid" : "high");

function Need({ id, value }: { id: NeedId; value: number }) {
  const { reduceMotion } = useTheme();
  const look = LOOK[id];
  const lvl = levelOf(value);
  const word = S.pet.level[id][lvl];
  const label = S.pet.needs[id];
  const pop = useSharedValue(0);
  const prev = useRef(value);
  useEffect(() => {
    if (value > prev.current + 40 && !reduceMotion)
      pop.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
    prev.current = value;
  }, [value, reduceMotion, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.12 * pop.get() }] }));
  return (
    <View style={{ width: look.w as `${number}%`, marginTop: look.lift }}>
      <Animated.View style={style}>
        <Sticker
          id={`need-${id}`}
          fill={look.fill}
          radius={id === "food" ? 28 : id === "love" ? 20 : 34}
          offset={4}
          padding={10}
          tiltMax={0}
          style={{ transform: [{ rotate: `${look.tilt}deg` }], alignItems: "center", gap: 4 }}
          accessibilityRole="text"
          accessibilityLabel={S.pet.a11y.need(label, word)}
        >
          <Glyph kind={look.glyph} size={44} level={value / NEED_MAX} fill={look.level} id={`need-${id}`} />
          <Text variant="caption" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {label}
          </Text>
          <Text variant="caption" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} color={lvl === "low" ? palette.strawberryDeep : undefined}>
            {word}
          </Text>
        </Sticker>
        {lvl === "low" ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -6,
              right: -4,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: palette.strawberry,
              borderWidth: 2.5,
              borderColor: palette.ink,
            }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export function NeedStickers({ needs }: { needs: Needs }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
      <Need id="food" value={needs.food} />
      <Need id="love" value={needs.love} />
      <Need id="energy" value={needs.energy} />
    </View>
  );
}
