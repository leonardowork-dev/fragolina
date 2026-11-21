import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { create } from "zustand";

import { Text, useTheme } from "@/design";
import { motion } from "@/design/tokens";
import { hashString, seeded } from "@/lib/hash";
import { S } from "@/lib/strings.it";

import { BedArt, CherryArt, CreamArt, HeartArt, LipsArt, SteamArt, WinkStrawberry } from "./ZoneArt";

/**
 * Le animazioni "porche ma mai esplicite" della zona. 5 varianti a rotazione casuale (non stanca):
 *  0 fragola che fa l'occhiolino e salta · 1 letto che traballa con vapore · 2 ciliegie e gocce di panna ·
 *  3 labbra che fanno smack · 4 vapore e cuori che scoppiano. Traguardi e match: festa più grande.
 * Solo transform e opacity, molle per ciò che nasce dal tocco, ease-out per il resto, mai scala da 0.
 * "Meno movimento": il disegno compare fermo (con la faccia che cambia) e svanisce, niente particelle.
 */
type HeatState = { seq: number; variant: number; kind: "plus" | "milestone" | "match"; label: string | null; fire: (kind?: "plus" | "milestone" | "match", label?: string | null) => void };
export const useHeat = create<HeatState>((set, get) => ({
  seq: 0,
  variant: 0,
  kind: "plus",
  label: null,
  fire: (kind = "plus", label = null) => {
    const seq = get().seq + 1;
    // la variante non si ripete due volte di fila
    let v = Math.floor(seeded(seq * 7919 + Date.now() % 1000) * 5);
    if (v === get().variant) v = (v + 1) % 5;
    set({ seq, variant: v, kind, label });
  },
}));

const COUNT = 16;
const DURATION = 1700;

function Sprite({ index, seq, variant, kind }: { index: number; seq: number; variant: number; kind: string }) {
  const { reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(1);
  const r1 = seeded(seq * 131 + index * 17);
  const r2 = seeded(seq * 197 + index * 29);
  const r3 = seeded(seq * 251 + index * 43);
  const x0 = width * (0.1 + 0.8 * r1);
  const rise = variant === 1 || variant === 4; // vapore: sale; il resto: piove
  const dur = DURATION * (0.8 + r2 * 0.5);

  useEffect(() => {
    t.set(0);
    t.set(withTiming(1, { duration: dur, easing: Easing.linear }));
  }, [seq, t, dur]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    const fade = p < 0.15 ? p / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    const y = rise ? height * 0.62 - p * height * 0.5 : -40 + p * height * (0.55 + 0.25 * r3);
    return { opacity: p >= 1 ? 0 : fade, transform: [{ translateX: x0 + Math.sin(p * 6 + r1 * 6) * 18 }, { translateY: y }, { rotate: `${(r3 - 0.5) * 120 * p}deg` }] };
  });

  if (reduceMotion) return null;
  const kindOf = (variant + index) % 3;
  const node =
    variant === 2 ? (index % 2 ? <CherryArt size={34} /> : <CreamArt size={28} />)
    : variant === 1 || variant === 4 ? (index % 3 === 0 ? <SteamArt size={30} /> : <HeartArt size={22 + (index % 3) * 6} />)
    : kindOf === 0 ? <HeartArt size={26} /> : kindOf === 1 ? <HeartArt size={20} fill="#FFB3C1" /> : <CherryArt size={26} />;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0 }, style]}>
      {kind === "match" && index % 2 ? <HeartArt size={24} fill="#C4143A" /> : node}
    </Animated.View>
  );
}

function Hero({ seq, variant }: { seq: number; variant: number }) {
  const { reduceMotion } = useTheme();
  const s = useSharedValue(0.75);
  const y = useSharedValue(0);
  const rot = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.set(0);
    o.set(withSequence(withTiming(1, { duration: 140, easing: motion.easeOut }), withTiming(1, { duration: reduceMotion ? 1100 : 1000 }), withTiming(0, { duration: 320, easing: motion.easeOut })));
    if (reduceMotion) return;
    s.set(0.75);
    s.set(withSpring(1, { duration: 450, dampingRatio: 0.5 }));
    y.set(0);
    rot.set(0);
    if (variant === 0) y.set(withSequence(withSpring(-46, { duration: 300, dampingRatio: 0.6 }), withSpring(0, { duration: 380, dampingRatio: 0.5 }), withSpring(-24, { duration: 260, dampingRatio: 0.6 }), withSpring(0, { duration: 340, dampingRatio: 0.5 })));
    if (variant === 1) rot.set(withSequence(...[-7, 7, -6, 6, -4, 4, -2, 0].map((d) => withTiming(d, { duration: 90, easing: motion.easeOut }))));
    if (variant === 3) s.set(withSequence(withSpring(1.25, { duration: 220, dampingRatio: 0.5 }), withSpring(0.95, { duration: 160, dampingRatio: 0.6 }), withSpring(1.15, { duration: 220, dampingRatio: 0.5 }), withSpring(1, { duration: 300, dampingRatio: 0.7 })));
    if (variant === 2 || variant === 4) rot.set(withSequence(withTiming(-5, { duration: 120, easing: motion.easeOut }), withTiming(5, { duration: 160, easing: motion.easeOut }), withTiming(0, { duration: 160, easing: motion.easeOut })));
  }, [seq, variant, reduceMotion, s, y, rot, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: y.get() }, { rotate: `${rot.get()}deg` }, { scale: s.get() }] }));
  const art = variant === 1 ? <BedArt size={190} /> : variant === 3 ? <LipsArt size={150} /> : variant === 4 ? <SteamArt size={90} /> : <WinkStrawberry size={160} wink={!reduceMotion || variant === 0} />;
  return <Animated.View style={[{ alignItems: "center" }, style]}>{art}</Animated.View>;
}

/** Montare UNA volta nella radice (sopra tutto, senza intercettare i tocchi). */
export function HeatBurstLayer() {
  const seq = useHeat((s) => s.seq);
  const variant = useHeat((s) => s.variant);
  const kind = useHeat((s) => s.kind);
  const label = useHeat((s) => s.label);
  if (seq === 0) return null;
  const bigger = kind !== "plus";
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", transform: [{ scale: bigger ? 1.25 : 1 }] }]}>
        <Hero key={`h${seq}`} seq={seq} variant={kind === "match" ? 3 : variant} />
      </View>
      {Array.from({ length: bigger ? COUNT : 12 }, (_, i) => (
        <Sprite key={`s${seq}-${i}`} index={i} seq={seq} variant={variant} kind={kind} />
      ))}
      {label ? (
        <View style={{ position: "absolute", left: 24, right: 24, top: "22%", alignItems: "center" }}>
          <Text variant="display" style={{ textAlign: "center" }}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const heatSeedFor = (id: string) => hashString(id);
export const HEAT_A11Y = S.zone.plusOneLabel;
