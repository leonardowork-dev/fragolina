import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { hashString, seeded } from "@/lib/hash";

import { useTheme } from "../ThemeProvider";
import { palette } from "../tokens";
import { useEffectsBus } from "./effectsStore";

/**
 * HeartBurst: al tocco partono cuori che volano fuori. 14 cuori in un pool fisso (nessun mount/unmount),
 * fisica deterministica (seme = numero del burst + indice), tutto sul thread UI: per ogni cuore un solo
 * shared value `t` (0→1) e uno stile animato. Nessun setState per frame.
 * Con "Meno movimento": i cuori compaiono e svaniscono sul posto (solo opacità).
 * Montare UNA volta nella radice: <HeartBurstLayer />. Far partire con useEffectsBus.getState().fireHearts(x, y).
 */
const COUNT = 14;
const DURATION = 1150;
const COLORS = [palette.strawberry, palette.blush, palette.strawberry, palette.butter];
const HEART_D = "M12 21 C5 15.6 3 11.8 3 8.6 C3 5.6 5.2 3.6 7.8 3.6 C9.6 3.6 11.2 4.6 12 6.1 C12.8 4.6 14.4 3.6 16.2 3.6 C18.8 3.6 21 5.6 21 8.6 C21 11.8 19 15.6 12 21 Z";

function Particle({ index }: { index: number }) {
  const { reduceMotion } = useTheme();
  const seq = useEffectsBus((s) => s.heartSeq);
  const t = useSharedValue(1);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const spin = useSharedValue(0);
  const size = 22 + Math.round(seeded(hashString(`h-size-${index}`)) * 14);
  const color = COLORS[index % COLORS.length]!;

  useEffect(() => {
    if (seq === 0) return;
    const r1 = seeded(seq * 131 + index * 17);
    const r2 = seeded(seq * 197 + index * 29);
    const r3 = seeded(seq * 251 + index * 43);
    const { heartX, heartY } = useEffectsBus.getState();
    const angle = -Math.PI / 2 + (index / COUNT - 0.5) * Math.PI * 1.15 + (r1 - 0.5) * 0.3;
    const speed = 170 + r2 * 190;
    ox.set(heartX - size / 2);
    oy.set(heartY - size / 2);
    vx.set(Math.cos(angle) * speed);
    vy.set(Math.sin(angle) * speed);
    spin.set((r3 - 0.5) * 70);
    t.set(0);
    t.set(withTiming(1, { duration: DURATION, easing: Easing.linear }));
  }, [seq, index, size, ox, oy, vx, vy, spin, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    const s = p * (DURATION / 1000);
    const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
    const visible = p >= 1 ? 0 : fade;
    if (reduceMotion) return { opacity: visible * 0.9, transform: [{ translateX: ox.get() }, { translateY: oy.get() }] };
    const g = 380;
    return {
      opacity: visible,
      transform: [
        { translateX: ox.get() + vx.get() * s },
        { translateY: oy.get() + vy.get() * s + 0.5 * g * s * s },
        { rotate: `${spin.get() * p}deg` },
        { scale: 0.9 + 0.25 * Math.min(p * 4, 1) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={HEART_D} fill={color} stroke={palette.ink} strokeWidth={1.9} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

export function HeartBurstLayer() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      {Array.from({ length: COUNT }, (_, i) => (
        <Particle key={i} index={i} />
      ))}
    </View>
  );
}
