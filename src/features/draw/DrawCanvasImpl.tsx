import { Canvas, Path, Skia, type SkPath, type SkPathBuilder } from "@shopify/react-native-skia";
import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { type SharedValue, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Tela Skia. Il tratto in corso vive in un SkPath su shared value: ogni punto è aggiunto sul thread UI (nessun
 * setState durante il disegno). A fine tratto si consegna una stringa SVG al React state (una volta, in onEnd).
 * I tratti già fatti si parsano una sola volta (useMemo). Uso interno: importare DrawCanvas, non questo file.
 */
export type Stroke = { id: number; svg: string; color: string; thick: boolean };
export type DrawCanvasProps = {
  color: string;
  /** Tratto spesso (3,4% del lato) o fine (1,7%): le stesse proporzioni del widget. */
  thick: boolean;
  strokes: Stroke[];
  onCommit: (svg: string, color: string, thick: boolean) => void;
  /** 0 = foglio bianco, 1 = c'è già inchiostro (nasconde il suggerimento). */
  inked: SharedValue<number>;
  width: number;
  height: number;
};

/** Spessori in proporzione al lato della tela: identici a quelli che il widget disegna (NoteDrawing). */
export const strokeFor = (side: number, thick: boolean) => side * (thick ? 0.034 : 0.017);

export default function DrawCanvasImpl({
  color,
  thick,
  strokes,
  onCommit,
  inked,
  width,
  height,
}: DrawCanvasProps) {
  // Skia 2.x: SkPath è immutabile, si costruisce con un SkPathBuilder e si pubblica lo snapshot.
  const builder = useSharedValue<SkPathBuilder>(Skia.PathBuilder.Make());
  const live = useSharedValue<SkPath>(Skia.PathBuilder.Make().build());
  const liveColor = useSharedValue(color);
  const liveThick = useSharedValue(thick);
  const liveWidth = useSharedValue(strokeFor(width, thick));

  useEffect(() => {
    liveColor.set(color);
    liveThick.set(thick);
    liveWidth.set(strokeFor(width, thick));
  }, [color, thick, width, liveColor, liveThick, liveWidth]);

  // Il tratto in corso si azzera quando il tratto confermato è arrivato nello stato (stesso commit: niente sfarfallio).
  useEffect(() => {
    builder.get().reset();
    live.set(builder.get().build());
    inked.set(strokes.length > 0 ? 1 : 0);
  }, [strokes.length, builder, live, inked]);

  const parsed = useMemo(
    () =>
      strokes.map((s) => ({
        id: s.id,
        color: s.color,
        thick: s.thick,
        path: Skia.Path.MakeFromSVGString(s.svg),
      })),
    [strokes],
  );

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onStart((e) => {
      inked.set(1);
      const b = builder.get();
      b.reset();
      b.moveTo(e.x, e.y);
      b.lineTo(e.x + 0.1, e.y + 0.1);
      live.set(b.build());
    })
    .onUpdate((e) => {
      const b = builder.get();
      b.lineTo(e.x, e.y);
      live.set(b.build());
    })
    .onEnd(() => {
      scheduleOnRN(onCommit, live.get().toSVGString(), liveColor.get(), liveThick.get());
    });

  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={{ width, height }}>
        <Canvas style={{ width, height }}>
          {parsed.map((s) =>
            s.path ? (
              <Path
                key={s.id}
                path={s.path}
                color={s.color}
                style="stroke"
                strokeWidth={strokeFor(width, s.thick)}
                strokeCap="round"
                strokeJoin="round"
              />
            ) : null,
          )}
          <Path
            path={live}
            color={color}
            style="stroke"
            strokeWidth={liveWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
