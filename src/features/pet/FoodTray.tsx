import React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type AnimatedRef,
  measure,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { Sticker, StickerPressable, Text, useTheme } from "@/design";
import { motion, palette } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { FOOD_IDS, type FoodId } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

import { Fruit } from "./Glyphs";

/**
 * Il vassoio dei frutti. Ogni frutto si trascina sul pet (molla, la velocità del dito passa alla molla, torna a posto
 * se lo lasci altrove); un tocco lo dà direttamente (alternativa per chi non trascina e per VoiceOver).
 */
const FILL: Record<FoodId, string> = {
  mora: palette.butterSoft,
  lampone: palette.blushSoft,
  mirtillo: palette.skySoft,
  pesca: palette.leafSoft,
};

function FoodItem({
  id,
  index,
  petRef,
  onFeed,
}: {
  id: FoodId;
  index: number;
  petRef: AnimatedRef<View>;
  onFeed: (id: FoodId) => void;
}) {
  const { reduceMotion } = useTheme();
  // Trascinato sul pet: un tocco leggero (il tocco semplice ha già il suo, dal bottone).
  const dropFeed = (f: FoodId) => {
    haptics.light();
    onFeed(f);
  };
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lift = useSharedValue(0);
  const gone = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      lift.set(withSpring(1, motion.springSnappy));
    })
    .onUpdate((e) => {
      x.set(e.translationX);
      y.set(e.translationY);
    })
    .onEnd((e) => {
      const r = measure(petRef);
      // Dentro al pet? Se non riesco a misurare, basta averlo portato in alto.
      const hit = r
        ? e.absoluteX >= r.pageX && e.absoluteX <= r.pageX + r.width && e.absoluteY >= r.pageY && e.absoluteY <= r.pageY + r.height
        : e.translationY < -90;
      if (hit) {
        scheduleOnRN(dropFeed, id);
        // il frutto "entra" nella bocca: si rimpicciolisce verso il pet e poi torna al suo posto, invisibile
        gone.set(withSequence(withTiming(1, { duration: 160, easing: motion.easeOut }), withTiming(0, { duration: 220 })));
        x.set(withTiming(0, { duration: 0 }));
        y.set(withTiming(0, { duration: 0 }));
      } else {
        x.set(withSpring(0, { ...motion.spring, velocity: e.velocityX }));
        y.set(withSpring(0, { ...motion.spring, velocity: e.velocityY }));
      }
    })
    .onFinalize(() => {
      lift.set(withSpring(0, motion.springSnappy));
    });

  const style = useAnimatedStyle(() => ({
    opacity: 1 - gone.get(),
    zIndex: lift.get() > 0.05 ? 10 : 0,
    transform: [
      { translateX: reduceMotion ? 0 : x.get() },
      { translateY: reduceMotion ? 0 : y.get() },
      { scale: 1 + 0.18 * lift.get() - 0.5 * gone.get() },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ width: "25%", alignItems: "center", marginTop: index % 2 ? 10 : 0 }, style]}>
        <StickerPressable
          accessibilityLabel={S.pet.a11y.food(S.pet.foods[id])}
          haptic="light"
          onPress={() => onFeed(id)}
          style={{ alignItems: "center", gap: 4, minWidth: 64, minHeight: 64 }}
        >
          <View style={{ backgroundColor: FILL[id], borderRadius: 18, borderWidth: 2.5, borderColor: palette.ink, padding: 6 }}>
            <Fruit id={id} size={46} />
          </View>
          <Text variant="caption" align="center">
            {S.pet.foods[id]}
          </Text>
        </StickerPressable>
      </Animated.View>
    </GestureDetector>
  );
}

export function FoodTray({ petRef, onFeed }: { petRef: AnimatedRef<View>; onFeed: (id: FoodId) => void }) {
  return (
    <Sticker id="food-tray" fill={palette.paper} radius={26} offset={4} padding={12} tiltMax={1} accessibilityRole="none">
      <Text variant="caption" style={{ marginBottom: 8 }}>
        {S.pet.feedHint}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {FOOD_IDS.map((id, i) => (
          <FoodItem key={id} id={id} index={i} petRef={petRef} onFeed={onFeed} />
        ))}
      </View>
    </Sticker>
  );
}
