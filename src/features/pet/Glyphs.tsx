import React from "react";
import Svg, { ClipPath, Defs, G, Path, Rect, Circle, Ellipse } from "react-native-svg";

import { palette } from "@/design/tokens";
import { HEART } from "@/design/mascot/Mascot";

import type { FoodId } from "@/lib/pet/rules";

/**
 * Piccoli disegni per i bisogni e le azioni (viewBox 48×48). Contorno inchiostro 2.5. `level` (0-1) riempie il disegno
 * dal basso: è così che i tre adesivi dei bisogni "si svuotano", ognuno con la sua forma.
 */
export type GlyphKind = "food" | "love" | "energy" | "play";

const FRUIT = "M24 13 C14 8 6 16 8 28 C10 40 20 45 24 43 C28 45 38 40 40 28 C42 16 34 8 24 13 Z";
const LEAF = "M24 13 C24 7 28 4 33 4 C33 9 29 13 24 13 Z";
const MOON = "M30 5 A19 19 0 1 0 43 35 A15 15 0 1 1 30 5 Z";

function shapePath(kind: GlyphKind) {
  if (kind === "food") return FRUIT;
  if (kind === "energy") return MOON;
  if (kind === "love") return "M24 42 C6 28 6 12 16 9 C21 8 24 12 24 12 C24 12 27 8 32 9 C42 12 42 28 24 42 Z";
  return "M24 6 A18 18 0 1 0 24 42 A18 18 0 1 0 24 6 Z";
}

export function Glyph({
  kind,
  size = 40,
  level = 1,
  fill = palette.strawberry,
  base = "#fff",
  id = "g",
}: {
  kind: GlyphKind;
  size?: number;
  level?: number;
  fill?: string;
  base?: string;
  id?: string;
}) {
  const d = shapePath(kind);
  const y = 48 * (1 - Math.max(0, Math.min(1, level)));
  const stroke = { stroke: palette.ink, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <ClipPath id={`clip-${id}`}>
          <Rect x={0} y={y} width={48} height={48 - y} />
        </ClipPath>
      </Defs>
      <Path d={d} fill={base} />
      <G clipPath={`url(#clip-${id})`}>
        <Path d={d} fill={fill} />
      </G>
      <Path d={d} fill="none" {...stroke} />
      {kind === "food" ? <Path d={LEAF} fill={palette.leaf} {...stroke} strokeWidth={2} /> : null}
      {kind === "play" ? <Path d="M8 20 Q24 32 40 20" fill="none" {...stroke} /> : null}
    </Svg>
  );
}

/** Frutti per il cibo (trascinabili). Forme diverse, colori diversi, niente viola. */
export function Fruit({ id, size = 52 }: { id: FoodId; size?: number }) {
  const ink = palette.ink;
  const st = { stroke: ink, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {id === "mora" ? (
        <G>
          {[
            [18, 22],
            [30, 22],
            [24, 30],
            [14, 31],
            [34, 31],
            [24, 40],
            [24, 17],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={7} fill={palette.strawberryDeep} {...st} strokeWidth={2} />
          ))}
          <Path d="M24 10 C22 6 26 3 31 4 C30 8 28 10 24 10 Z" fill={palette.leaf} {...st} strokeWidth={2} />
        </G>
      ) : null}
      {id === "lampone" ? (
        <G>
          <Path d="M24 44 C12 40 8 28 12 18 C16 10 32 10 36 18 C40 28 36 40 24 44 Z" fill={palette.strawberry} {...st} />
          {[
            [18, 22],
            [28, 22],
            [23, 29],
            [17, 33],
            [30, 33],
          ].map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={2.4} fill={palette.strawberryDeep} />
          ))}
          <Path d="M24 14 C20 8 25 4 31 5 C31 10 28 13 24 14 Z" fill={palette.leaf} {...st} strokeWidth={2} />
        </G>
      ) : null}
      {id === "mirtillo" ? (
        <G>
          <Circle cx={24} cy={27} r={16} fill={palette.sky} {...st} />
          <Path d="M24 19 L20 23 L24 27 L28 23 Z" fill={ink} />
          <Path d="M13 20 Q16 15 21 14" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </G>
      ) : null}
      {id === "pesca" ? (
        <G>
          <Path d="M24 12 C10 8 4 22 9 33 C13 42 21 45 24 43 C27 45 35 42 39 33 C44 22 38 8 24 12 Z" fill={palette.blush} {...st} />
          <Path d="M24 12 C26 22 26 34 24 43" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />
          <Ellipse cx={33} cy={9} rx={7} ry={4} fill={palette.leaf} {...st} strokeWidth={2} transform="rotate(-25 33 9)" />
        </G>
      ) : null}
    </Svg>
  );
}

export const HEART_D = HEART;
