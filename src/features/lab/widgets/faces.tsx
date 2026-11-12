import React from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { palette as P } from "@/design/tokens";

/** Porting SVG di targets/widget/Faces.swift (stessa geometria) per l'anteprima nel laboratorio. */
export const MOOD_FILL: Record<string, string> = {
  felice: P.butter,
  innamorata: P.blush,
  stanca: P.sky,
  affamata: P.leaf,
  stressata: P.strawberry,
  triste: P.skySoft,
  coccole: P.blushSoft,
  carica: P.butterSoft,
};
export const moodFill = (id: string | null) => (id ? (MOOD_FILL[id] ?? P.butter) : P.butter);

const BODY =
  "M110 64 C150 48 192 66 188 118 C184 170 146 214 110 222 C74 214 36 170 32 118 C28 66 70 48 110 64 Z";
const LEAVES = [
  "M110 68 C98 46 102 26 110 14 C118 26 122 46 110 68 Z",
  "M106 70 C82 70 58 60 48 42 C74 38 98 48 106 70 Z",
  "M114 70 C138 70 162 60 172 42 C146 38 122 48 114 70 Z",
];
const SEEDS: [number, number][] = [
  [60, 176],
  [160, 176],
  [86, 198],
  [134, 198],
  [44, 112],
  [176, 112],
];
const HEART = "M0 8 C-12 -2 -8 -12 0 -5 C8 -12 12 -2 0 8 Z";
const STAR = "M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z";

function Features({ mood, ink, white, cheek, sw }: { mood: string | null; ink: string; white: string | null; cheek: string | null; sw: number }) {
  const line = { stroke: ink, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const dot = (x: number, y: number) => (
    <>
      <Circle cx={x} cy={y} r={4.6} fill={ink} />
      {white ? <Circle cx={x + 1.6} cy={y - 1.6} r={1.5} fill={white} /> : null}
    </>
  );
  let body: React.ReactNode;
  switch (mood) {
    case "innamorata":
      body = (
        <>
          <G transform="translate(36 42) scale(1.25)"><Path d={HEART} fill={ink} /></G>
          <G transform="translate(64 42) scale(1.25)"><Path d={HEART} fill={ink} /></G>
          <Path d="M41 61 Q50 72 59 61" {...line} />
        </>
      );
      break;
    case "stanca":
      body = (
        <>
          <Path d="M29 45 Q37 53 45 45" {...line} />
          <Path d="M55 45 Q63 53 71 45" {...line} />
          <Path d="M43 64 L57 64" {...line} />
        </>
      );
      break;
    case "affamata":
      body = (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path d="M34 56 Q50 82 66 56 Z" fill={ink} />
        </>
      );
      break;
    case "stressata":
      body = (
        <>
          {[36, 64].map((x) => (
            <G key={x}>
              <Circle cx={x} cy={42} r={8} fill={white ?? "none"} stroke={ink} strokeWidth={2.6} />
              <Circle cx={x + (x < 50 ? 1 : -1)} cy={43} r={2.6} fill={ink} />
            </G>
          ))}
          <Path d="M30 66 Q36 59 42 66 Q48 73 54 66 Q60 59 66 66" {...line} />
        </>
      );
      break;
    case "triste":
      body = (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path d="M38 68 Q50 56 62 68" {...line} />
        </>
      );
      break;
    case "coccole":
      body = (
        <>
          <Path d="M29 46 Q37 37 45 46" {...line} />
          <Path d="M55 46 Q63 37 71 46" {...line} />
          <Path d="M42 58 Q46 65 50 58 Q54 65 58 58" {...line} />
        </>
      );
      break;
    case "carica":
      body = (
        <>
          <G transform="translate(36 42) scale(1.15)"><Path d={STAR} fill={ink} /></G>
          <G transform="translate(64 42) scale(1.15)"><Path d={STAR} fill={ink} /></G>
          <Path d="M33 56 Q50 74 67 56" {...line} />
        </>
      );
      break;
    default:
      body = (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path d="M31 55 Q50 80 69 55 Z" fill={ink} />
        </>
      );
  }
  return (
    <G>
      {body}
      {cheek && (mood === "coccole" || mood === "innamorata") ? (
        <>
          <Ellipse cx={24.5} cy={54.5} rx={6.5} ry={4.5} fill={cheek} />
          <Ellipse cx={75.5} cy={54.5} rx={6.5} ry={4.5} fill={cheek} />
        </>
      ) : null}
    </G>
  );
}

export function StrawberryFace({ mood = "felice", sleeping = false, size = 70 }: { mood?: string | null; sleeping?: boolean; size?: number }) {
  const ink = P.ink;
  const z = { stroke: ink, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={(size * 240) / 220} viewBox="0 0 220 240">
      <G transform="translate(6 6)">
        <Path d={BODY} stroke={ink} strokeWidth={19} strokeLinejoin="round" fill={ink} />
      </G>
      <Path d={BODY} stroke={ink} strokeWidth={19} strokeLinejoin="round" />
      <Path d={BODY} stroke={P.white} strokeWidth={14} strokeLinejoin="round" fill={P.white} />
      <Path d={BODY} fill={P.strawberry} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      {SEEDS.map(([x, y]) => (
        <Ellipse key={`${x}${y}`} cx={x} cy={y} rx={3.4} ry={5} fill={P.butterSoft} />
      ))}
      {LEAVES.map((d) => (
        <Path key={d} d={d} fill={P.leaf} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {sleeping ? (
        <G>
          <Path d="M68 126 Q80 138 92 126" {...z} strokeWidth={7} />
          <Path d="M128 126 Q140 138 152 126" {...z} strokeWidth={7} />
          <Ellipse cx={58} cy={147.5} rx={14} ry={8.5} fill={P.blush} />
          <Ellipse cx={162} cy={147.5} rx={14} ry={8.5} fill={P.blush} />
          <Path d="M103 150 Q110 156 117 150" {...z} strokeWidth={7} />
          <Path d="M160 62 L174 62 L160 78 L174 78" {...z} strokeWidth={6} />
        </G>
      ) : (
        <G>
          {mood !== "coccole" && mood !== "innamorata" ? (
            <>
              <Ellipse cx={58} cy={147.5} rx={14} ry={8.5} fill={P.blush} />
              <Ellipse cx={162} cy={147.5} rx={14} ry={8.5} fill={P.blush} />
            </>
          ) : null}
          <G transform="translate(110 144) scale(2.3) translate(-50 -50)">
            <Features mood={mood} ink={ink} white={P.white} cheek={P.strawberrySoft} sw={3.8} />
          </G>
        </G>
      )}
    </Svg>
  );
}

export function LockMoodGlyph({ mood, size = 40 }: { mood: string | null; size?: number }) {
  const ink = "currentColor";
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={44} stroke={ink} strokeWidth={6} fill="none" />
      {mood === null ? (
        [32, 50, 68].map((x) => <Circle key={x} cx={x} cy={50} r={4.5} fill={ink} />)
      ) : (
        <Features mood={mood} ink={ink} white={null} cheek={null} sw={6} />
      )}
    </Svg>
  );
}

const CONFETTI = [
  [0.06, 0.1, 20, 0, 0], [0.3, 0.05, -30, 1, 1], [0.52, 0.12, 40, 2, 2], [0.78, 0.06, -15, 0, 3],
  [0.94, 0.2, 35, 1, 4], [0.04, 0.42, -40, 2, 3], [0.96, 0.5, 15, 0, 1], [0.1, 0.8, 30, 1, 2],
  [0.34, 0.94, -25, 0, 4], [0.58, 0.9, 45, 2, 0], [0.82, 0.92, -35, 1, 3], [0.93, 0.78, 20, 2, 1],
] as const;
const CONF_COLORS = [P.strawberry, P.butter, P.sky, P.leaf, P.blush];

export function Confetti({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      {CONFETTI.map(([x, y, r, k, c], i) => (
        <G key={i} transform={`translate(${x * w} ${y * h}) rotate(${r})`}>
          {k === 0 ? (
            <Rect x={-4} y={-2.5} width={8} height={5} fill={CONF_COLORS[c]} stroke={P.ink} strokeWidth={1.2} />
          ) : k === 1 ? (
            <Circle r={3} fill={CONF_COLORS[c]} stroke={P.ink} strokeWidth={1.2} />
          ) : (
            <Path d="M0 -4 L4 3 L-4 3 Z" fill={CONF_COLORS[c]} stroke={P.ink} strokeWidth={1.2} />
          )}
        </G>
      ))}
    </Svg>
  );
}
