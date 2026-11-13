import React from "react";
import Svg, { Circle, Polyline } from "react-native-svg";

import { palette } from "@/design/tokens";
import { type BgKey, type InkKey, type NoteStroke, NOTE_GRID } from "@/lib/note/rules";

/** Colori dei pennarelli e degli sfondi (nomi della palette → token). Specchio di noteInk/noteBg in targets/widget/NoteWidget.swift. */
export const INK_HEX: Record<InkKey, string> = {
  ink: palette.ink,
  strawberry: palette.strawberry,
  leaf: palette.leaf,
  sky: palette.sky,
  butter: palette.butter,
};
export const BG_HEX: Record<BgKey, string> = {
  butter: palette.butter,
  blush: palette.blush,
  sky: palette.sky,
  leaf: palette.leaf,
  strawberry: palette.strawberry,
  paper: palette.paper,
};

/**
 * Il disegno del biglietto come SVG: stessi vettori (punti 0-1000) che il widget ridisegna con Canvas. Spessori in
 * percentuale del lato (fine 1,7%, spesso 3,4%), con un minimo in pixel; `mono` = un solo colore, più spesso (blocco).
 */
export function NoteDrawingSvg({
  strokes,
  size,
  mono,
}: {
  strokes: NoteStroke[];
  size: number;
  /** Colore unico (schermata di blocco). */
  mono?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${NOTE_GRID} ${NOTE_GRID}`}>
      {strokes.map((s, i) => {
        const thick = s.w >= 2;
        const basePx = size * (thick ? 0.034 : 0.017);
        const px = mono ? Math.max(basePx * 1.5, thick ? 4.5 : 3) : Math.max(basePx, thick ? 3 : 2);
        const sw = (px * NOTE_GRID) / size;
        const color = mono ?? INK_HEX[s.c];
        const first = s.p[0];
        if (!first) return null;
        if (s.p.every((q) => q[0] === first[0] && q[1] === first[1]))
          return <Circle key={i} cx={first[0]} cy={first[1]} r={sw / 2} fill={color} />;
        return (
          <Polyline
            key={i}
            points={s.p.map((q) => `${q[0]},${q[1]}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}
