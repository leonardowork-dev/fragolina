import React from "react";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { palette } from "@/design/tokens";

/** Disegni dei giochi (pedine e adesivi della schermata Gioca). Solo riempimenti piatti e contorno inchiostro. */
const ink = palette.ink;

/** Pedina fragola (chi muove per primo). */
export function StrawberryPiece({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 90 C26 80 14 58 18 40 C21 28 33 24 50 28 C67 24 79 28 82 40 C86 58 74 80 50 90 Z"
        fill={palette.strawberry}
        stroke={ink}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <Path
        d="M32 28 L40 14 L50 24 L60 14 L68 28 L50 34 Z"
        fill={palette.leaf}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {[
        [36, 48],
        [56, 46],
        [46, 62],
        [64, 62],
        [34, 66],
        [50, 76],
      ].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3.2} fill={palette.butter} />
      ))}
    </Svg>
  );
}

/** Pedina fiore (l'altra persona). */
export function FlowerPiece({ size = 64 }: { size?: number }) {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26] as const;
  });
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {petals.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={17} fill={palette.sky} stroke={ink} strokeWidth={4.5} />
      ))}
      <Circle cx={50} cy={50} r={15} fill={palette.butter} stroke={ink} strokeWidth={4.5} />
    </Svg>
  );
}

export function TrisArt({ size = 128 }: { size?: number }) {
  const l = { stroke: ink, strokeWidth: 5, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d="M40 8 V112 M80 8 V112 M8 40 H112 M8 80 H112" {...l} />
      <G transform="translate(8 8) scale(0.28)">
        <Path
          d="M50 90 C26 80 14 58 18 40 C21 28 33 24 50 28 C67 24 79 28 82 40 C86 58 74 80 50 90 Z"
          fill={palette.strawberry}
          stroke={ink}
          strokeWidth={9}
        />
      </G>
      <Circle cx={60} cy={60} r={13} fill={palette.sky} stroke={ink} strokeWidth={5} />
      <G transform="translate(84 84) scale(0.28)">
        <Path
          d="M50 90 C26 80 14 58 18 40 C21 28 33 24 50 28 C67 24 79 28 82 40 C86 58 74 80 50 90 Z"
          fill={palette.strawberry}
          stroke={ink}
          strokeWidth={9}
        />
      </G>
    </Svg>
  );
}

export function QuizArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="rotate(-8 30 50)">
        <Rect x={6} y={22} width={44} height={58} rx={9} fill={palette.butter} stroke={ink} strokeWidth={4} />
        <Path d="M20 44 Q20 34 28 34 Q36 34 36 42 Q36 48 28 52 L28 56" stroke={ink} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        <Circle cx={28} cy={65} r={2.8} fill={ink} />
      </G>
      <G transform="rotate(9 70 50)">
        <Rect x={48} y={18} width={44} height={58} rx={9} fill={palette.blush} stroke={ink} strokeWidth={4} />
        <Path
          d="M70 36 C63 42 62 50 70 58 C78 50 77 42 70 36 Z"
          fill={palette.strawberry}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

export function DrawArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M18 78 L24 56 L66 14 Q72 9 78 15 L86 23 Q91 29 86 35 L44 77 Z"
        fill={palette.butter}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path d="M18 78 L24 56 L44 77 Z" fill={ink} />
      <Path d="M8 92 Q28 82 40 90 T72 88" stroke={palette.strawberry} strokeWidth={5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
