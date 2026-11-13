import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type AnimatedRef,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Sticker, useTheme } from "@/design";
import { type PetFace, PetArt, STAGE_SCALE, faceForMood } from "@/design/mascot/PetArt";
import { motion } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import type { PetMood, PetStage } from "@/lib/pet/rules";

/**
 * Il palcoscenico del pet: pannello adesivo con il pet grande al centro. Il pet respira (dondolio lento), ammicca,
 * reagisce (schiaccia e salta) e si lascia accarezzare con il dito: passa avanti e indietro, il pet segue la mano
 * (rubber-band), un tick ogni tanto, un successo quando la carezza è completa.
 * Tutto interrompibile; con "Meno movimento" restano solo il cambio di faccia e l'aptica.
 */
export type PetReaction = { face: PetFace; nonce: number };

/** Strisciata totale (px) perché una carezza conti. */
export const CARESS_MIN = 240;

function rubber(d: number, dim: number) {
  "worklet";
  const s = d < 0 ? -1 : 1;
  const a = Math.abs(d);
  return s * (1 - 1 / ((a * 0.55) / dim + 1)) * dim;
}

export function PetStageView({
  stage,
  mood,
  crack = 0,
  reaction,
  caress,
  onCaress,
  onPoke,
  size = 232,
  petRef,
  a11yLabel,
  a11yHint,
}: {
  stage: PetStage;
  mood: PetMood;
  crack?: number;
  reaction: PetReaction | null;
  caress: boolean;
  onCaress?: () => void;
  onPoke: () => void;
  size?: number;
  petRef?: AnimatedRef<View>;
  a11yLabel: string;
  a11yHint?: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const asleep = mood === "asleep" || mood === "away";
  const [blink, setBlink] = useState(false);
  const [petting, setPetting] = useState(false);
  const [shown, setShown] = useState<PetFace | null>(null);
  const shownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bobY = useSharedValue(0);
  const breathe = useSharedValue(0);
  const squish = useSharedValue(0);
  const hop = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dist = useSharedValue(0);
  const lastX = useSharedValue(0);
  const night = useSharedValue(asleep ? 1 : 0);

  // Notte: il pannello si scurisce (dissolvenza piatta, non un movimento).
  useEffect(() => {
    night.set(withTiming(asleep ? 1 : 0, { duration: reduceMotion ? 0 : 300, easing: motion.easeOut }));
  }, [asleep, night, reduceMotion]);

  // Respiro: dondolio lento da svegli, pancia che si gonfia da addormentati.
  useEffect(() => {
    if (reduceMotion || stage === "egg") {
      bobY.set(0);
      breathe.set(0);
      return;
    }
    const ease = Easing.bezier(0.45, 0, 0.55, 1);
    if (asleep) {
      bobY.set(withTiming(0, { duration: 200 }));
      breathe.set(withRepeat(withSequence(withTiming(1, { duration: 2200, easing: ease }), withTiming(0, { duration: 2200, easing: ease })), -1));
    } else {
      breathe.set(withTiming(0, { duration: 200 }));
      bobY.set(withRepeat(withSequence(withTiming(-size * 0.022, { duration: 1700, easing: ease }), withTiming(0, { duration: 1700, easing: ease })), -1));
    }
  }, [asleep, reduceMotion, size, stage, bobY, breathe]);

  // Ammicca ogni 3-5 s (cambio di faccia, non movimento: resta anche con "Meno movimento").
  useEffect(() => {
    if (asleep || stage === "egg") return;
    let alive = true;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(
        () => {
          if (!alive) return;
          setBlink(true);
          setTimeout(() => {
            if (!alive) return;
            setBlink(false);
            schedule();
          }, 130);
        },
        3000 + Math.random() * 2000,
      );
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [asleep, stage]);

  // Reazione (ho dato da mangiare, l'altra persona ha coccolato…): faccia per un momento + salto.
  const lastNonce = useRef(reaction?.nonce ?? 0);
  useEffect(() => {
    if (!reaction || reaction.nonce === lastNonce.current) return;
    lastNonce.current = reaction.nonce;
    setShown(reaction.face);
    if (shownTimer.current) clearTimeout(shownTimer.current);
    shownTimer.current = setTimeout(() => setShown(null), 1500);
    if (!reduceMotion) {
      squish.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
      hop.set(withSequence(withTiming(-size * 0.07, { duration: 140, easing: motion.easeOut }), withSpring(0, motion.springBouncy)));
    }
  }, [reaction, reduceMotion, squish, hop, size]);
  useEffect(
    () => () => {
      if (shownTimer.current) clearTimeout(shownTimer.current);
    },
    [],
  );

  const pan = Gesture.Pan()
    .enabled(caress)
    .activeOffsetX([-10, 10])
    .failOffsetY([-28, 28])
    .onBegin((e) => {
      lastX.set(e.x);
      dist.set(0);
    })
    .onUpdate((e) => {
      dist.set(dist.get() + Math.abs(e.x - lastX.get()));
      lastX.set(e.x);
      if (!reduceMotion) {
        tx.set(rubber(e.translationX, 28));
        ty.set(rubber(e.translationY, 10));
      }
    })
    .onEnd((e) => {
      if (dist.get() >= CARESS_MIN && onCaress) scheduleOnRN(onCaress);
      if (!reduceMotion) tx.set(withSpring(0, { ...motion.spring, velocity: e.velocityX }));
    })
    .onFinalize((_, success) => {
      if (!reduceMotion) {
        if (!success) tx.set(withSpring(0, motion.spring));
        ty.set(withSpring(0, motion.spring));
      }
      dist.set(0);
    });
  const tap = Gesture.Tap().onEnd((_, ok) => {
    if (ok) scheduleOnRN(onPoke);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  // Un tick ogni ~90 px di carezza, e la faccia "innamorata" mentre dura (a soglia, mai per frame).
  useAnimatedReaction(
    () => Math.floor(dist.get() / 90),
    (cur, prev) => {
      if (prev !== null && cur > prev) scheduleOnRN(haptics.tick);
    },
  );
  useAnimatedReaction(
    () => dist.get() > 40,
    (cur, prev) => {
      if (cur !== prev) scheduleOnRN(setPetting, cur);
    },
  );

  const bodyStyle = useAnimatedStyle(() => {
    const q = squish.get();
    const b = breathe.get();
    return {
      transform: [
        { translateX: tx.get() },
        { translateY: bobY.get() + hop.get() + ty.get() },
        { rotate: `${tx.get() / 7}deg` },
        { scaleX: 1 + 0.1 * q - 0.012 * b },
        { scaleY: 1 - 0.1 * q + 0.02 * b },
      ],
    };
  });
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.get() * 0.8 }));

  const face: PetFace = stage === "egg" ? "calm" : (shown ?? (petting ? "love" : faceForMood(mood)));
  const h = size * (250 / 220);
  // Il pannello cresce col pet: il semino non galleggia in uno spazio enorme.
  const panelH = Math.round(h * (stage === "egg" ? 1 : 0.4 + 0.6 * STAGE_SCALE[stage]) + 56);

  return (
    <Sticker
      id="pet-stage"
      fill={colors.skySoft}
      radius={32}
      offset={6}
      padding={0}
      tiltMax={0}
      overflowVisible={false}
      style={{ alignSelf: "stretch" }}
      accessibilityRole="none"
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.ink }, nightStyle]}
      />
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={a11yLabel}
          accessibilityHint={a11yHint}
          onAccessibilityTap={onPoke}
          style={{ alignItems: "center", justifyContent: "flex-end", paddingTop: 22, paddingBottom: 22, minHeight: panelH }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: 18,
              width: size * 0.62,
              height: size * 0.07,
              borderRadius: size,
              backgroundColor: colors.ink,
              opacity: 0.14,
            }}
          />
          <Animated.View ref={petRef} style={[bodyStyle, { transformOrigin: "50% 100%" }]}>
            <PetArt stage={stage} face={face} size={size} crack={crack} blink={blink} />
          </Animated.View>
        </View>
      </GestureDetector>
    </Sticker>
  );
}
