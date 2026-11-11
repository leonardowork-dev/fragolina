import { Image } from "expo-image";
import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

import { MOOD_IDS, type MoodId } from "@/features/home/moods";
import { S } from "@/lib/strings.it";
import { userArt } from "@/lib/userArt.generated";

import { palette } from "../tokens";

/**
 * Gli otto adesivi umore, disegnati nel codice (cerchio, contorno inchiostro, faccia diversa per umore).
 * Se esiste assets/user-art/sticker-N.png (N = posizione in MOOD_IDS) viene usato quello.
 * Uso: <MoodSticker mood="felice" size={72} />
 */
const FILL: Record<MoodId, string> = {
  felice: palette.butter,
  innamorata: palette.blush,
  stanca: palette.sky,
  affamata: palette.leaf,
  stressata: palette.strawberry,
  triste: palette.skySoft,
  coccole: palette.blushSoft,
  carica: palette.butterSoft,
};
const INK = palette.ink;
const HEART = "M0 8 C-12 -2 -8 -12 0 -5 C8 -12 12 -2 0 8 Z";
const STAR = "M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z";

function features(mood: MoodId, sw: number): React.ReactNode {
  const line = {
    stroke: INK,
    strokeWidth: sw * 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const dot = (cx: number, cy: number, r = 4.6) => (
    <>
      <Circle cx={cx} cy={cy} r={r} fill={INK} />
      <Circle cx={cx + 1.6} cy={cy - 1.6} r={1.5} fill="#fff" />
    </>
  );
  switch (mood) {
    case "felice":
      return (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path
            d="M31 55 Q50 78 69 55 Z"
            fill={INK}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Path
            d="M40 62 Q50 68 60 62"
            stroke={palette.strawberrySoft}
            strokeWidth={sw * 1.6}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case "innamorata":
      return (
        <>
          <G transform="translate(36 42)">
            <Path
              d={HEART}
              fill={palette.strawberry}
              stroke={INK}
              strokeWidth={sw * 0.9}
              strokeLinejoin="round"
            />
          </G>
          <G transform="translate(64 42)">
            <Path
              d={HEART}
              fill={palette.strawberry}
              stroke={INK}
              strokeWidth={sw * 0.9}
              strokeLinejoin="round"
            />
          </G>
          <Path d="M41 60 Q50 70 59 60" {...line} />
        </>
      );
    case "stanca":
      return (
        <>
          <Path d="M29 45 Q37 53 45 45" {...line} />
          <Path d="M55 45 Q63 53 71 45" {...line} />
          <Path d="M43 64 H57" {...line} />
          <Path d="M66 18 h11 l-11 13 h11" {...line} strokeWidth={sw * 1.1} />
        </>
      );
    case "affamata":
      return (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path
            d="M34 56 Q50 80 66 56 Z"
            fill={INK}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Path d="M44 68 Q50 62 56 68 Q50 74 44 68 Z" fill={palette.strawberrySoft} />
          <Path
            d="M71 60 Q76 68 71 72 Q66 68 71 60 Z"
            fill={palette.sky}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </>
      );
    case "stressata":
      return (
        <>
          <Circle cx={36} cy={42} r={8} fill="#fff" stroke={INK} strokeWidth={sw} />
          <Circle cx={64} cy={42} r={8} fill="#fff" stroke={INK} strokeWidth={sw} />
          <Circle cx={37} cy={43} r={2.6} fill={INK} />
          <Circle cx={63} cy={43} r={2.6} fill={INK} />
          <Path d="M30 66 Q36 59 42 66 T54 66 T66 66" {...line} />
          <Path
            d="M78 20 Q83 28 78 33 Q73 28 78 20 Z"
            fill={palette.sky}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </>
      );
    case "triste":
      return (
        <>
          {dot(37, 42)}
          {dot(63, 42)}
          <Path d="M38 68 Q50 56 62 68" {...line} />
          <Path
            d="M33 54 Q38 62 33 66 Q28 62 33 54 Z"
            fill={palette.sky}
            stroke={INK}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </>
      );
    case "coccole":
      return (
        <>
          <Path d="M29 46 Q37 37 45 46" {...line} />
          <Path d="M55 46 Q63 37 71 46" {...line} />
          <Circle cx={30} cy={56} r={5.5} fill={palette.strawberrySoft} />
          <Circle cx={70} cy={56} r={5.5} fill={palette.strawberrySoft} />
          <Path d="M42 58 Q46 65 50 58 Q54 65 58 58" {...line} />
          <G transform="translate(78 22) scale(0.7)">
            <Path
              d={HEART}
              fill={palette.strawberry}
              stroke={INK}
              strokeWidth={sw * 1.2}
              strokeLinejoin="round"
            />
          </G>
        </>
      );
    case "carica":
      return (
        <>
          <G transform="translate(36 42) scale(1.05)">
            <Path d={STAR} fill={INK} />
          </G>
          <G transform="translate(64 42) scale(1.05)">
            <Path d={STAR} fill={INK} />
          </G>
          <Path d="M33 56 Q50 74 67 56" {...line} />
          <Path
            d="M72 16 L66 28 H73 L67 40"
            stroke={INK}
            strokeWidth={sw * 1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={palette.butter}
          />
        </>
      );
  }
}

export function MoodSticker({ mood, size = 72 }: { mood: MoodId; size?: number }) {
  const idx = MOOD_IDS.indexOf(mood);
  const custom = userArt.stickers[idx] ?? null;
  const sw = (2.5 * 100) / size;
  if (custom) {
    return (
      <Image
        source={custom}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel={S.moods[mood]}
      />
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={S.moods[mood]}>
      <Circle cx={50} cy={50} r={44} fill={FILL[mood]} stroke={INK} strokeWidth={sw} />
      {features(mood, sw)}
    </Svg>
  );
}
