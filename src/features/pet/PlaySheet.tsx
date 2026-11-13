import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Mascot, Sheet, Sticker, StickerPressable, Text, useTheme } from "@/design";
import { motion } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";

/**
 * Il gioco: una fragolina rimbalza nell'area, tocca per prenderla tre volte. Pochi secondi.
 * Il rimbalzo gira sul thread UI (useFrameCallback) senza mai toccare React; ogni presa la fa più veloce.
 * Con "Meno movimento" la fragola sta ferma e salta in un altro punto a ogni presa.
 */
const AREA_H = 230;
const SPRITE = 76;

export function PlaySheet({ visible, onClose, onWin }: { visible: boolean; onClose: () => void; onWin: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={S.pet.playTitle}>
      <PlayGame visible={visible} onClose={onClose} onWin={onWin} />
    </Sheet>
  );
}

// Il pannello smonta il contenuto a ogni chiusura: ogni partita riparte da zero senza effetti.
function PlayGame({ visible, onClose, onWin }: { visible: boolean; onClose: () => void; onWin: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const [caught, setCaught] = useState(0);
  const [w, setW] = useState(300);
  const x = useSharedValue(30);
  const y = useSharedValue(30);
  const vx = useSharedValue(2.4);
  const vy = useSharedValue(1.9);
  const pop = useSharedValue(0);
  const speed = useSharedValue(1);
  const wSv = useSharedValue(300);
  const active = useSharedValue(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    active.set(visible && !reduceMotion);
  }, [visible, reduceMotion, active]);
  useEffect(() => () => void (doneTimer.current && clearTimeout(doneTimer.current)), []);

  useFrameCallback((f) => {
    if (!active.get()) return;
    const dt = Math.min((f.timeSincePreviousFrame ?? 16) / 16, 3);
    let nx = x.get() + vx.get() * speed.get() * dt;
    let ny = y.get() + vy.get() * speed.get() * dt;
    const maxX = wSv.get() - SPRITE;
    const maxY = AREA_H - SPRITE;
    if (nx < 0) {
      nx = 0;
      vx.set(Math.abs(vx.get()));
    }
    if (nx > maxX) {
      nx = maxX;
      vx.set(-Math.abs(vx.get()));
    }
    if (ny < 0) {
      ny = 0;
      vy.set(Math.abs(vy.get()));
    }
    if (ny > maxY) {
      ny = maxY;
      vy.set(-Math.abs(vy.get()));
    }
    x.set(nx);
    y.set(ny);
  });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 1 + 0.3 * pop.get() }],
  }));

  const hit = () => {
    const n = caught + 1;
    haptics.light();
    if (!reduceMotion) pop.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, motion.springBouncy)));
    speed.set(speed.get() * 1.35);
    if (reduceMotion) {
      x.set(Math.random() * (w - SPRITE));
      y.set(Math.random() * (AREA_H - SPRITE));
    } else {
      vx.set(-vx.get());
      vy.set(vy.get() * (Math.random() < 0.5 ? -1 : 1));
    }
    setCaught(n);
    if (n >= 3) {
      haptics.success();
      onWin();
      doneTimer.current = setTimeout(onClose, 900);
    }
  };

  return (
    <>
      <View style={{ gap: 14, paddingBottom: 12 }}>
        <Text variant="body">{caught >= 3 ? S.pet.playDone : S.pet.playBody}</Text>
        <Sticker id="play-area" fill={colors.leafSoft} radius={28} offset={4} padding={0} tiltMax={0} accessibilityRole="none">
          <View
            style={{ height: AREA_H, overflow: "hidden", borderRadius: 26 }}
            onLayout={(e) => {
              setW(e.nativeEvent.layout.width);
              wSv.set(e.nativeEvent.layout.width);
            }}
          >
            <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: SPRITE, height: SPRITE }, style]}>
              <StickerPressable
                accessibilityLabel={S.pet.a11y.playTarget}
                onPress={hit}
                haptic="none"
                hitSlop={14}
                style={{ width: SPRITE, height: SPRITE, alignItems: "center", justifyContent: "center" }}
              >
                <Mascot size={62} mood={caught >= 3 ? "happy" : "surprised"} tappable={false} bob={false} />
              </StickerPressable>
            </Animated.View>
          </View>
        </Sticker>
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">
          {S.pet.playScore(Math.min(3, caught))}
        </Text>
      </View>
    </>
  );
}
