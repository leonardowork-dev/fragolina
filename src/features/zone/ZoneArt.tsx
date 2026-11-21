import React from "react";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import { palette } from "@/design/tokens";

/**
 * Adesivi della zona: tutto disegnato (react-native-svg), contorno ink 2.5, riempimenti piatti, nessuna emoji.
 * Il bello è l'allusione: fragola che arrossisce e fa l'occhiolino, letto che traballa, vapore, labbra, ciliegie, panna.
 */
const INK = palette.ink;
const SW = 2.5;
const HEART_D = "M12 21 C5 15.6 3 11.8 3 8.6 C3 5.6 5.2 3.6 7.8 3.6 C9.6 3.6 11.2 4.6 12 6.1 C12.8 4.6 14.4 3.6 16.2 3.6 C18.8 3.6 21 5.6 21 8.6 C21 11.8 19 15.6 12 21 Z";

export function HeartArt({ size = 24, fill = palette.strawberry }: { size?: number; fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HEART_D} fill={fill} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function FlameArt({ size = 22, on = true }: { size?: number; on?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2 C13 6 18 8 18 14 C18 18.4 15.4 21.5 12 21.5 C8.6 21.5 6 18.4 6 14.6 C6 12 7.4 10.4 8.6 9 C9 11 10 11.6 10.8 11.6 C10.4 8 10.6 5 12 2 Z" fill={on ? palette.butter : palette.blushSoft} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M12 12.5 C13.4 14 14.4 15 14.4 16.6 C14.4 18 13.4 19 12 19 C10.6 19 9.6 18 9.6 16.8 C9.6 15.4 11 14.4 12 12.5 Z" fill={on ? palette.strawberry : palette.blush} />
    </Svg>
  );
}

/** La fragola che arrossisce; con `wink` fa l'occhiolino. */
export function WinkStrawberry({ size = 140, wink = true }: { size?: number; wink?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Path d="M60 12 C52 22 44 20 38 14 C42 26 50 30 60 28 C70 30 78 26 82 14 C76 20 68 22 60 12 Z" fill={palette.leaf} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <Path d="M60 26 C92 22 104 46 100 70 C96 96 76 112 60 112 C44 112 24 96 20 70 C16 46 28 22 60 26 Z" fill={palette.strawberry} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <G fill={palette.butterSoft}>
        <Ellipse cx={42} cy={52} rx={2.4} ry={3.4} />
        <Ellipse cx={80} cy={48} rx={2.4} ry={3.4} />
        <Ellipse cx={36} cy={76} rx={2.4} ry={3.4} />
        <Ellipse cx={86} cy={74} rx={2.4} ry={3.4} />
        <Ellipse cx={60} cy={100} rx={2.4} ry={3.4} />
      </G>
      <Ellipse cx={38} cy={68} rx={9} ry={6} fill={palette.blush} opacity={0.95} />
      <Ellipse cx={82} cy={68} rx={9} ry={6} fill={palette.blush} opacity={0.95} />
      <Circle cx={46} cy={58} r={5.2} fill={palette.white} stroke={INK} strokeWidth={2} />
      <Circle cx={47} cy={59} r={2.6} fill={INK} />
      {wink ? (
        <Path d="M68 59 Q74 52 80 59" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      ) : (
        <>
          <Circle cx={74} cy={58} r={5.2} fill={palette.white} stroke={INK} strokeWidth={2} />
          <Circle cx={75} cy={59} r={2.6} fill={INK} />
        </>
      )}
      <Path d="M50 76 Q60 88 72 74" fill={palette.white} stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Il letto adesivo che traballa (il movimento lo dà chi lo usa). */
export function BedArt({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 150 105">
      <Rect x={8} y={20} width={14} height={78} rx={5} fill={palette.butter} stroke={INK} strokeWidth={SW} />
      <Rect x={128} y={34} width={14} height={64} rx={5} fill={palette.butter} stroke={INK} strokeWidth={SW} />
      <Rect x={18} y={62} width={116} height={26} rx={8} fill={palette.skySoft} stroke={INK} strokeWidth={SW} />
      <Path d="M20 62 C40 48 56 76 76 60 C96 46 110 72 132 58 L132 70 L20 74 Z" fill={palette.blush} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <Rect x={24} y={44} width={34} height={20} rx={9} fill={palette.white} stroke={INK} strokeWidth={SW} />
      <Rect x={18} y={88} width={8} height={12} rx={3} fill={INK} />
      <Rect x={124} y={88} width={8} height={12} rx={3} fill={INK} />
    </Svg>
  );
}

export function LipsArt({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 100 62">
      <Path d="M6 32 C20 14 36 12 50 22 C64 12 80 14 94 32 C80 54 62 58 50 56 C38 58 20 54 6 32 Z" fill={palette.strawberry} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <Path d="M8 32 C26 38 40 36 50 28 C60 36 74 38 92 32" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M30 20 C36 18 42 19 46 23" fill="none" stroke={palette.white} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
}

export function CherryArt({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M14 26 C16 14 22 8 30 4 M26 26 C26 16 28 10 30 4" fill="none" stroke={palette.leaf} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={13} cy={29} r={8} fill={palette.strawberryDeep} stroke={INK} strokeWidth={2.2} />
      <Circle cx={27} cy={30} r={8} fill={palette.strawberry} stroke={INK} strokeWidth={2.2} />
      <Circle cx={10} cy={26} r={2} fill={palette.white} opacity={0.8} />
    </Svg>
  );
}

export function CreamArt({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Path d="M18 4 C22 10 28 14 28 22 C28 28 24 32 18 32 C12 32 8 28 8 22 C8 14 14 10 18 4 Z" fill={palette.white} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M14 22 C14 25 16 27 18 27" fill="none" stroke={palette.blush} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function SteamArt({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 40 52">
      <Path d="M12 48 C4 40 18 34 12 26 C6 18 16 12 12 4" fill="none" stroke={palette.blush} strokeWidth={6} strokeLinecap="round" />
      <Path d="M28 48 C20 40 34 34 28 26 C22 18 32 12 28 4" fill="none" stroke={palette.strawberrySoft} strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

/** Un dado: facce con punti (1-6). */
export function DieFace({ n, size = 64 }: { n: number; size?: number }) {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={5} y={5} width={90} height={90} rx={22} fill={palette.white} stroke={INK} strokeWidth={4} />
      {(dots[Math.min(6, Math.max(1, n))] ?? []).map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={8} fill={palette.strawberry} />
      ))}
    </Svg>
  );
}
