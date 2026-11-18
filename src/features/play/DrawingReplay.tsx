import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Polyline } from "react-native-svg";

import { useTheme } from "@/design";
import { motion } from "@/design/tokens";
import { type NoteDraw, NOTE_GRID } from "@/lib/note/rules";

import { INK_HEX } from "../draw/NoteArt";

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

type Piece = { points: string; len: number; start: number; sw: number; color: string; dot: [number, number] | null };

/** Lunghezze e inizio di ogni tratto sulla "striscia" totale (per scandire i tratti uno dopo l'altro). */
function layout(draw: NoteDraw, size: number): { pieces: Piece[]; total: number } {
  let acc = 0;
  const pieces: Piece[] = draw.strokes.map((s) => {
    const thick = s.w >= 2;
    const sw = (Math.max(size * (thick ? 0.034 : 0.017), thick ? 3 : 2) * NOTE_GRID) / size;
    let len = 0;
    for (let i = 1; i < s.p.length; i++) len += Math.hypot(s.p[i][0] - s.p[i - 1][0], s.p[i][1] - s.p[i - 1][1]);
    const first = s.p[0];
    const isDot = len < 1;
    const piece: Piece = {
      points: s.p.map((q) => `${q[0]},${q[1]}`).join(" "),
      len: Math.max(len, 1),
      start: acc,
      sw,
      color: INK_HEX[s.c],
      dot: isDot && first ? [first[0], first[1]] : null,
    };
    acc += piece.len + 40; // una piccola pausa fra un tratto e l'altro
    return piece;
  });
  return { pieces, total: Math.max(acc, 1) };
}

function Stroke({ piece, total, progress }: { piece: Piece; total: number; progress: { get: () => number } }) {
  const props = useAnimatedProps(() => {
    const drawn = progress.get() * total - piece.start;
    const shown = Math.min(piece.len, Math.max(0, drawn));
    // dash = tratto visibile + resto invisibile
    return { strokeDasharray: [shown, piece.len + 2000], opacity: shown <= 0 ? 0 : 1 };
  });
  return (
    <AnimatedPolyline
      points={piece.points}
      fill="none"
      stroke={piece.color}
      strokeWidth={piece.sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      animatedProps={props}
    />
  );
}

/**
 * Il disegno riprodotto tratto per tratto (easeOut). Con "Meno movimento", sul web (anteprima) o se `still`: subito
 * intero. Cambiando `replayKey` riparte.
 */
export function DrawingReplay({
  draw,
  size,
  replayKey,
  still,
}: {
  draw: NoteDraw;
  size: number;
  replayKey: number | string;
  still?: boolean;
}) {
  const { reduceMotion } = useTheme();
  const { pieces, total } = useMemo(() => layout(draw, size), [draw, size]);
  const instant = !!still || reduceMotion;
  const progress = useSharedValue(instant ? 1 : 0);
  useEffect(() => {
    if (instant) return void progress.set(1);
    progress.set(0);
    const ms = Math.min(5200, Math.max(1400, draw.strokes.length * 520));
    progress.set(withTiming(1, { duration: ms, easing: motion.easeOut }));
  }, [instant, replayKey, draw, progress]);
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image">
      <Svg width={size} height={size} viewBox={`0 0 ${NOTE_GRID} ${NOTE_GRID}`}>
        {pieces.map((p, i) =>
          p.dot ? (
            <Circle key={i} cx={p.dot[0]} cy={p.dot[1]} r={p.sw / 2} fill={p.color} />
          ) : instant ? (
            <Polyline
              key={i}
              points={p.points}
              fill="none"
              stroke={p.color}
              strokeWidth={p.sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Stroke key={i} piece={p} total={total} progress={progress} />
          ),
        )}
      </Svg>
    </View>
  );
}
