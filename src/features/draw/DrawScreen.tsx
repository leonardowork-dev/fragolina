import React, { useCallback, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Button, Sticker, StickerPressable, Text, useTheme } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { outline, PAGE_MARGIN, palette } from "@/design/tokens";
import { S } from "@/lib/strings.it";

import { DrawCanvas, type Stroke } from "./DrawCanvas";

/** Disegna: schizzo con quattro pennarelli adesivo. Per ora resta sul telefono (non viene inviato). */
const PENS = [
  { key: "strawberry", color: palette.strawberry },
  { key: "leaf", color: palette.leaf },
  { key: "sky", color: palette.sky },
  { key: "butter", color: palette.butter },
] as const;

export function DrawScreen() {
  const { colors } = useTheme();
  const { width: winW } = useWindowDimensions();
  const [pen, setPen] = useState<(typeof PENS)[number]>(PENS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const nextId = useRef(1);
  const inked = useSharedValue(0);

  const cw = Math.min(winW - PAGE_MARGIN * 2 - 6, 560);
  const ch = Math.round(cw * 1.02);

  const onCommit = useCallback((svg: string, color: string) => {
    setStrokes((s) => [...s, { id: nextId.current++, svg, color }]);
  }, []);

  const hint = useAnimatedStyle(() => ({ opacity: withTiming(inked.get() > 0 ? 0 : 1, { duration: 160 }) }));

  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {S.draw.title}
      </Text>
      <Sticker id="tela" fill={colors.white} radius={24} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: cw }}>
        <View style={{ width: cw - outline.width * 2, height: ch }}>
          <DrawCanvas color={pen.color} strokes={strokes} onCommit={onCommit} inked={inked} width={cw - outline.width * 2} height={ch} />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 20, top: 20, right: 20 }, hint]}>
            <Text variant="title" color={colors.ink} style={{ opacity: 0.55 }}>
              {S.draw.empty}
            </Text>
          </Animated.View>
        </View>
      </Sticker>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }} accessibilityRole="radiogroup">
        {PENS.map((p, i) => {
          const selected = p.key === pen.key;
          return (
            <StickerPressable
              key={p.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={S.draw.pen(S.draw.pens[p.key])}
              haptic="tick"
              onPress={() => setPen(p)}
              style={{ transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * 3}deg` }, { scale: selected ? 1.14 : 1 }] }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: p.color, borderWidth: outline.width, borderColor: colors.outline, alignItems: "center", justifyContent: "center" }}>
                {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.ink }} /> : null}
              </View>
            </StickerPressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <Button
          label={S.draw.undo}
          variant="secondary"
          disabled={strokes.length === 0}
          onPress={() => setStrokes((s) => s.slice(0, -1))}
          haptic="light"
        />
        <Button
          label={S.draw.clear}
          variant="ghost"
          disabled={strokes.length === 0}
          onPress={() => setStrokes([])}
          haptic="medium"
        />
      </View>
      <Text variant="body">{S.draw.body}</Text>
    </Screen>
  );
}
