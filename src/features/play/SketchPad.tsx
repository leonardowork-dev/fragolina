import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Button, Chip, Sticker, StickerPressable, Text, useTheme } from "@/design";
import { outline } from "@/design/tokens";
import { INK_KEYS, type InkKey, type NoteDraw, buildDraw, pointsFromSvg } from "@/lib/note/rules";
import { S } from "@/lib/strings.it";

import { DrawCanvas, type Stroke } from "../draw/DrawCanvas";
import { INK_HEX } from "../draw/NoteArt";

const inkOf = (hex: string): InkKey => (INK_KEYS.find((k) => INK_HEX[k] === hex) ?? "ink") as InkKey;

/**
 * La tela di "Disegna e indovina": la stessa tela Skia della scheda Disegna (vettori della sessione 5), con 5 pennarelli,
 * fine/spesso e annulla. Consegna al genitore il disegno già in vettori 0-1000 (`null` = foglio bianco). Per ripulirla
 * basta cambiarle la `key`.
 */
export function SketchPad({
  size,
  locked,
  onChange,
}: {
  size: number;
  locked?: boolean;
  onChange: (d: NoteDraw | null) => void;
}) {
  const { colors } = useTheme();
  const [pen, setPen] = useState<InkKey>("strawberry");
  const [thick, setThick] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const nextId = useRef(1);
  const inked = useSharedValue(0);
  const inner = size - outline.width * 2;

  const onCommit = useCallback(
    (svg: string, color: string, isThick: boolean) => {
      if (locked) return;
      setStrokes((s) => [...s, { id: nextId.current++, svg, color, thick: isThick }]);
    },
    [locked],
  );
  const draw = useMemo(
    () =>
      strokes.length
        ? buildDraw(strokes.map((s) => ({ points: pointsFromSvg(s.svg), color: inkOf(s.color), thick: s.thick })), inner)
        : null,
    [strokes, inner],
  );
  useEffect(() => onChange(draw), [draw, onChange]);

  const hint = useAnimatedStyle(() => ({ opacity: withTiming(inked.get() > 0 ? 0 : 1, { duration: 160 }) }));

  return (
    <View style={{ gap: 14 }}>
      <Sticker id="sketch" fill={colors.white} radius={24} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: size }}>
        <View
          style={{ width: inner, height: inner, opacity: locked ? 0.6 : 1 }}
          accessibilityLabel={S.play.draw.canvasLabel}
          accessibilityHint={S.play.draw.canvasHint}
        >
          <DrawCanvas
            color={INK_HEX[pen]}
            thick={thick}
            strokes={strokes}
            onCommit={onCommit}
            inked={inked}
            width={inner}
            height={inner}
          />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 20, top: 20, right: 20 }, hint]}>
            <Text variant="title" style={{ opacity: 0.55 }}>
              {S.draw.empty}
            </Text>
          </Animated.View>
        </View>
      </Sticker>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }} accessibilityRole="radiogroup">
        {INK_KEYS.map((k, i) => {
          const selected = k === pen;
          return (
            <StickerPressable
              key={k}
              disabled={locked}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={S.draw.pen(S.draw.pens[k])}
              haptic="tick"
              onPress={() => setPen(k)}
              style={{ transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * 3}deg` }, { scale: selected ? 1.14 : 1 }] }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  backgroundColor: INK_HEX[k],
                  borderWidth: outline.width,
                  borderColor: colors.outline,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: k === "ink" ? colors.white : colors.ink }} /> : null}
              </View>
            </StickerPressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Chip id="g-thin" label={S.draw.thin} selected={!thick} onPress={() => setThick(false)} />
        <Chip id="g-thick" label={S.draw.thick} selected={thick} onPress={() => setThick(true)} />
        <Button label={S.draw.undo} variant="secondary" disabled={strokes.length === 0 || locked} onPress={() => setStrokes((s) => s.slice(0, -1))} haptic="light" />
      </View>
    </View>
  );
}
