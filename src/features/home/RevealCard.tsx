import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Sticker, Text, useTheme } from "@/design";
import { motion, radius } from "@/design/tokens";
import { S } from "@/lib/strings.it";

/**
 * Carta che si gira: davanti "ha risposto, tocca per scoprire", dietro la risposta.
 * Giro = molla (tocco), solo transform; con "Meno movimento" diventa una dissolvenza di 160 ms.
 * `revealed` iniziale vero (già scoperta in passato) = parte già girata, senza animazione.
 */
export function RevealCard({
  partnerName,
  answerLabel,
  verdict,
  revealed,
  onReveal,
}: {
  partnerName: string;
  answerLabel: string;
  verdict: string;
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
      : {
          opacity: k.get() > 0.5 ? 0 : 1,
          transform: [
            { perspective: 900 },
            { rotateY: `${interpolate(k.get(), [0, 1], [0, 180])}deg` },
          ],
        },
  );
  const back = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: k.get(), transform: [] }
      : {
          opacity: k.get() > 0.5 ? 1 : 0,
          transform: [
            { perspective: 900 },
            { rotateY: `${interpolate(k.get(), [0, 1], [180, 360])}deg` },
          ],
        },
  );

  return (
    <View style={{ height: 104 }} accessibilityLiveRegion="polite">
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 4,
            top: 0,
            bottom: 4,
            backfaceVisibility: "hidden",
          },
          front,
        ]}
        pointerEvents={revealed ? "none" : "auto"}
      >
        <Sticker
          id="rivela-fronte"
          fill={colors.blush}
          radius={radius.lg}
          offset={4}
          padding={16}
          tiltMax={1.2}
          onPress={onReveal}
          haptic="light"
          accessibilityLabel={S.a11y.flipCard(partnerName)}
          faceStyle={{ minHeight: 96, justifyContent: "center" }}
        >
          <Text variant="title">{S.home.revealBack(partnerName)}</Text>
          <Text variant="bodyStrong">{S.home.revealTap}</Text>
        </Sticker>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 4,
            top: 0,
            bottom: 4,
            backfaceVisibility: "hidden",
          },
          back,
        ]}
        pointerEvents={revealed ? "auto" : "none"}
      >
        <Sticker
          id="rivela-retro"
          fill={colors.leafSoft}
          radius={radius.lg}
          offset={4}
          padding={16}
          tiltMax={1}
          faceStyle={{ minHeight: 96, justifyContent: "center" }}
        >
          <Text variant="bodyStrong">{S.home.partnerAnswered(partnerName, answerLabel)}</Text>
          <Text variant="body">{verdict}</Text>
        </Sticker>
      </Animated.View>
    </View>
  );
}
