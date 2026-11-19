import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";

import { Sticker, Text, useTheme } from "@/design";
import { motion, radius } from "@/design/tokens";
import { S } from "@/lib/strings.it";

/**
 * La rivelazione: due risposte AFFIANCATE. Prima una carta che dice "ha risposto, gira" (la risposta di lei non è ancora
 * stata mostrata), poi la carta si gira (molla, solo transform) e compaiono le due risposte una accanto all'altra.
 * "Meno movimento": dissolvenza di 160 ms. `revealed` iniziale vero = parte già girata, senza animazione.
 */
export function FlipPair({
  partnerName,
  mine,
  theirs,
  revealed,
  onReveal,
}: {
  partnerName: string;
  mine: string;
  theirs: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const k = useSharedValue(revealed ? 1 : 0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) k.set(withTiming(revealed ? 1 : 0, { duration: 160 }));
    else k.set(withSpring(revealed ? 1 : 0, motion.spring));
  }, [revealed, reduceMotion, k]);

  const front = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - k.get(), transform: [] }
      : { opacity: k.get() > 0.5 ? 0 : 1, transform: [{ perspective: 900 }, { rotateY: `${interpolate(k.get(), [0, 1], [0, 180])}deg` }] },
  );
  const back = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: k.get(), transform: [] }
      : { opacity: k.get() > 0.5 ? 1 : 0, transform: [{ perspective: 900 }, { rotateY: `${interpolate(k.get(), [0, 1], [180, 360])}deg` }] },
  );

  return (
    <View accessibilityLiveRegion="polite" style={{ minHeight: 120 }}>
      <Animated.View style={[{ flexDirection: "row", gap: 12, alignItems: "stretch", paddingRight: 4, paddingBottom: 4 }, back]} pointerEvents={revealed ? "auto" : "none"} testID="qa-pair">
        <Sticker id="qa-mine" fill={colors.leafSoft} radius={radius.lg} offset={4} padding={14} tiltMax={1} style={{ flex: 1 }} faceStyle={{ flex: 1 }}>
          <View style={{ gap: 6 }}>
            <Text variant="caption">{S.qa.yours}</Text>
            <Text variant="bodyStrong" testID="qa-mine-text">
              {mine}
            </Text>
          </View>
        </Sticker>
        <Sticker id="qa-theirs" fill={colors.skySoft} radius={radius.lg} offset={4} padding={14} tiltMax={1} style={{ flex: 1 }} faceStyle={{ flex: 1 }}>
          <View style={{ gap: 6 }}>
            <Text variant="caption">{S.qa.theirs(partnerName)}</Text>
            <Text variant="bodyStrong" testID="qa-theirs-text">
              {theirs}
            </Text>
          </View>
        </Sticker>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 0, right: 4, top: 0, bottom: 4, backfaceVisibility: "hidden" }, front]} pointerEvents={revealed ? "none" : "auto"}>
        <Sticker
          id="qa-cover"
          fill={colors.blush}
          radius={radius.lg}
          offset={4}
          padding={16}
          tiltMax={1.2}
          onPress={onReveal}
          haptic="light"
          accessibilityLabel={S.qa.flip}
          accessibilityHint={S.qa.flipHint}
          style={{ flex: 1 }}
          faceStyle={{ flex: 1, justifyContent: "center" }}
        >
          <Text variant="title">{S.qa.revealTitle}</Text>
          <Text variant="bodyStrong">{S.qa.flipHint}</Text>
        </Sticker>
      </Animated.View>
    </View>
  );
}
