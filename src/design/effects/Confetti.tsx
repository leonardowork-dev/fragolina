import React, { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { hashString, seeded } from "@/lib/hash";

import { useTheme } from "../ThemeProvider";
import { palette } from "../tokens";
import { useEffectsBus } from "./effectsStore";

/**
 * Confetti a forma di adesivo (cerchi, quadrati, stelle, cuori con contorno). Breve (~1.8s), 34 pezzi in pool,
 * fisica deterministica sul thread UI. Solo per momenti rari (fine onboarding). Con "Meno movimento": niente.
 * Montare una volta nella radice: <ConfettiLayer />. Far partire con useEffectsBus.getState().fireConfetti().
 */
const COUNT = 34;
const DURATION = 1800;
const COLORS = [palette.strawberry, palette.butter, palette.sky, palette.leaf, palette.blush];
const STAR = "M12 2 L14.6 9.4 L22 12 L14.6 14.6 L12 22 L9.4 14.6 L2 12 L9.4 9.4 Z";
const HEART =
  "M12 21 C5 15.6 3 11.8 3 8.6 C3 5.6 5.2 3.6 7.8 3.6 C9.6 3.6 11.2 4.6 12 6.1 C12.8 4.6 14.4 3.6 16.2 3.6 C18.8 3.6 21 5.6 21 8.6 C21 11.8 19 15.6 12 21 Z";

function Piece({ index }: { index: number }) {
  const { reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const seq = useEffectsBus((s) => s.confettiSeq);
  const t = useSharedValue(1);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const spin = useSharedValue(0);
  const size = 14 + Math.round(seeded(hashString(`c-size-${index}`)) * 10);
  const color = COLORS[index % COLORS.length]!;
  const shape = index % 4;

  useEffect(() => {
    if (seq === 0 || reduceMotion) return;
    const { confettiX, confettiY } = useEffectsBus.getState();
    const r1 = seeded(seq * 71 + index * 13);
    const r2 = seeded(seq * 97 + index * 31);
    const r3 = seeded(seq * 151 + index * 47);
    const cx = confettiX < 0 ? width / 2 : confettiX;
    const cy = confettiY < 0 ? height * 0.38 : confettiY;
    const angle = -Math.PI / 2 + (r1 - 0.5) * Math.PI * 1.3;
    const speed = 260 + r2 * 360;
    ox.set(cx - size / 2);
    oy.set(cy - size / 2);
    vx.set(Math.cos(angle) * speed);
    vy.set(Math.sin(angle) * speed);
    spin.set((r3 - 0.5) * 900);
    t.set(0);
    t.set(withTiming(1, { duration: DURATION, easing: Easing.linear }));
  }, [seq, reduceMotion, index, size, width, height, ox, oy, vx, vy, spin, t]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    const s = p * (DURATION / 1000);
    const g = 900;
    return {
      opacity: p >= 1 ? 0 : p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
      transform: [
        { translateX: ox.get() + vx.get() * s * 0.8 },
        { translateY: oy.get() + vy.get() * s + 0.5 * g * s * s },
        { rotate: `${spin.get() * p}deg` },
      ],
    };
  });

  const common = {
    fill: color,
    stroke: palette.ink,
    strokeWidth: 2.2,
    strokeLinejoin: "round" as const,
  };
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shape === 0 ? <Circle cx={12} cy={12} r={9} {...common} /> : null}
        {shape === 1 ? <Rect x={4} y={4} width={16} height={16} rx={3} {...common} /> : null}
        {shape === 2 ? <Path d={STAR} {...common} /> : null}
        {shape === 3 ? <Path d={HEART} {...common} /> : null}
      </Svg>
    </Animated.View>
  );
}

export function ConfettiLayer() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: COUNT }, (_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}
