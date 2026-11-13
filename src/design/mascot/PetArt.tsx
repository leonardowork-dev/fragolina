import React from "react";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import type { PetStage } from "@/lib/pet/rules";

import { palette } from "../tokens";
import { BODY, HEART, LEAVES, SEEDS } from "./Mascot";

/**
 * Il pet: la stessa fragola adesivo della mascotte, in quattro stadi (semino, germoglio, fragolina, fragolona) più
 * l'uovo. Piatto, contorno inchiostro, ombra dura, bordo bianco fustellato. Le facce seguono i bisogni.
 * Solo disegno: il movimento (dondolio, schiaccia, carezza) lo dà chi lo usa.
 */
export type PetFace =
  | "calm"
  | "happy"
  | "love"
  | "hungry"
  | "waiting"
  | "sleepy"
  | "asleep"
  | "eat"
  | "surprised";

const SCALE: Record<Exclude<PetStage, "egg">, number> = { seed: 0.52, sprout: 0.7, berry: 0.86, big: 1 };
const FILL: Record<Exclude<PetStage, "egg">, string> = {
  seed: palette.butter,
  sprout: palette.strawberrySoft,
  berry: palette.strawberry,
  big: palette.strawberry,
};
const LEAF_COUNT: Record<Exclude<PetStage, "egg">, number> = { seed: 1, sprout: 3, berry: 5, big: 5 };
const SEED_COUNT: Record<Exclude<PetStage, "egg">, number> = { seed: 3, sprout: 5, berry: 8, big: 8 };

const EGG =
  "M110 18 C160 18 198 92 198 148 C198 202 160 232 110 232 C60 232 22 202 22 148 C22 92 60 18 110 18 Z";
// Crepe, dalla più piccola alla più grande: ogni gruppo si aggiunge al precedente.
const CRACKS = [
  "M96 22 L104 44 L92 58",
  "M150 46 L136 66 L148 84 L132 98",
  "M60 96 L78 110 L64 128 L84 142",
];

function Face({ face, blink, sw }: { face: PetFace; blink: boolean; sw: number }) {
  const ink = palette.ink;
  const line = {
    stroke: ink,
    strokeWidth: sw * 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };
  const cheeks = (rx = 14, ry = 8.5, fill: string = palette.blush) => (
    <>
      <Ellipse cx={58} cy={148} rx={rx} ry={ry} fill={fill} />
      <Ellipse cx={162} cy={148} rx={rx} ry={ry} fill={fill} />
    </>
  );
  switch (face) {
    case "happy":
      return (
        <G>
          {cheeks()}
          <Path d="M68 130 Q80 112 92 130" {...line} />
          <Path d="M128 130 Q140 112 152 130" {...line} />
          <Path d="M94 144 Q110 172 126 144 Z" fill={ink} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
          <Ellipse cx={110} cy={159} rx={8} ry={4.5} fill={palette.strawberrySoft} />
        </G>
      );
    case "love":
      return (
        <G>
          {cheeks(15, 9.5, palette.strawberrySoft)}
          <G transform="translate(80 124) scale(1.05)">
            <Path d={HEART} fill={ink} />
          </G>
          <G transform="translate(140 124) scale(1.05)">
            <Path d={HEART} fill={ink} />
          </G>
          <Circle cx={76} cy={121} r={2.6} fill="#fff" />
          <Circle cx={136} cy={121} r={2.6} fill="#fff" />
          <Path d="M99 146 Q110 160 121 146" {...line} />
        </G>
      );
    case "sleepy":
      return (
        <G>
          {cheeks()}
          <Path d="M68 126 Q80 138 92 126" {...line} />
          <Path d="M128 126 Q140 138 152 126" {...line} />
          <Path d="M103 150 Q110 155 117 150" {...line} />
          <Path d="M160 62 h14 l-14 16 h14" {...line} strokeWidth={sw * 1.2} />
        </G>
      );
    case "asleep":
      return (
        <G>
          {cheeks()}
          <Path d="M68 128 Q80 138 92 128" {...line} />
          <Path d="M128 128 Q140 138 152 128" {...line} />
          <Ellipse cx={110} cy={152} rx={5} ry={6} fill={ink} />
          <Path d="M158 66 h16 l-16 18 h16" {...line} strokeWidth={sw * 1.3} />
          <Path d="M182 40 h10 l-10 12 h10" {...line} strokeWidth={sw} />
        </G>
      );
    case "hungry":
      return (
        <G>
          {cheeks()}
          <Circle cx={80} cy={128} r={8.5} fill={ink} />
          <Circle cx={140} cy={128} r={8.5} fill={ink} />
          <Circle cx={77} cy={125} r={3} fill="#fff" />
          <Circle cx={137} cy={125} r={3} fill="#fff" />
          <Ellipse cx={110} cy={154} rx={9} ry={11} fill={ink} />
          <Ellipse cx={110} cy={160} rx={5} ry={4} fill={palette.strawberrySoft} />
          <Path
            d="M176 96 C170 106 168 112 176 114 C184 112 182 106 176 96 Z"
            fill={palette.sky}
            stroke={ink}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </G>
      );
    case "waiting":
      return (
        <G>
          {cheeks()}
          <Path d="M66 108 Q76 100 90 104" {...line} strokeWidth={sw * 1.2} />
          <Path d="M130 104 Q144 100 154 108" {...line} strokeWidth={sw * 1.2} />
          <Circle cx={80} cy={128} r={11} fill={ink} />
          <Circle cx={140} cy={128} r={11} fill={ink} />
          <Circle cx={84} cy={123} r={4.2} fill="#fff" />
          <Circle cx={144} cy={123} r={4.2} fill="#fff" />
          <Circle cx={76} cy={134} r={2} fill="#fff" />
          <Circle cx={136} cy={134} r={2} fill="#fff" />
          <Path d="M101 150 Q110 157 119 150" {...line} />
        </G>
      );
    case "eat":
      return (
        <G>
          {cheeks(18, 11)}
          <Path d="M68 128 Q80 114 92 128" {...line} />
          <Path d="M128 128 Q140 114 152 128" {...line} />
          <Ellipse cx={110} cy={152} rx={10} ry={8} fill={ink} />
          <Circle cx={92} cy={168} r={2.4} fill={palette.strawberryDeep} />
          <Circle cx={130} cy={170} r={2} fill={palette.strawberryDeep} />
        </G>
      );
    case "surprised":
      return (
        <G>
          {cheeks()}
          <Circle cx={80} cy={124} r={12} fill={ink} />
          <Circle cx={140} cy={124} r={12} fill={ink} />
          <Circle cx={84} cy={119} r={4.5} fill="#fff" />
          <Circle cx={144} cy={119} r={4.5} fill="#fff" />
          <Ellipse cx={110} cy={153} rx={7} ry={9.5} fill={ink} />
        </G>
      );
    default:
      return (
        <G>
          {cheeks()}
          {blink ? (
            <>
              <Path d="M71 128 Q80 133 89 128" {...line} />
              <Path d="M131 128 Q140 133 149 128" {...line} />
            </>
          ) : (
            <>
              <Circle cx={80} cy={126} r={9} fill={ink} />
              <Circle cx={140} cy={126} r={9} fill={ink} />
              <Circle cx={83.5} cy={122.5} r={3.2} fill="#fff" />
              <Circle cx={143.5} cy={122.5} r={3.2} fill="#fff" />
            </>
          )}
          <Path d="M101 145 Q110 154 119 145" {...line} />
        </G>
      );
  }
}

function Flower({ sw }: { sw: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <G transform="translate(110 28)">
      {petals.map((a) => (
        <Ellipse
          key={a}
          cx={0}
          cy={-11}
          rx={7}
          ry={9}
          fill="#fff"
          stroke={palette.ink}
          strokeWidth={sw * 0.8}
          transform={`rotate(${a})`}
        />
      ))}
      <Circle r={6.5} fill={palette.butter} stroke={palette.ink} strokeWidth={sw * 0.8} />
    </G>
  );
}

export type PetArtProps = {
  stage: PetStage;
  face: PetFace;
  size?: number;
  /** Uovo: 0-3 crepe (più tocchi, più crepe). */
  crack?: number;
  blink?: boolean;
  shadow?: boolean;
};

export function PetArt({ stage, face, size = 260, crack = 0, blink = false, shadow = true }: PetArtProps) {
  const sw = (2.5 * 220) / size;
  const h = size * (250 / 220);
  if (stage === "egg") {
    const ink = palette.ink;
    const line = { stroke: ink, strokeWidth: sw * 1.6, strokeLinecap: "round" as const, fill: "none" };
    return (
      <Svg width={size} height={h} viewBox="0 0 220 250">
        <G transform="translate(8 8)">
          <Path d={EGG} fill={ink} stroke={ink} strokeWidth={sw} />
        </G>
        <Path d={EGG} fill={palette.butterSoft} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <Ellipse cx={62} cy={96} rx={15} ry={11} fill={palette.strawberry} stroke={ink} strokeWidth={sw * 0.7} transform="rotate(-18 62 96)" />
        <Ellipse cx={156} cy={72} rx={11} ry={8} fill={palette.sky} stroke={ink} strokeWidth={sw * 0.7} transform="rotate(14 156 72)" />
        <Ellipse cx={164} cy={176} rx={14} ry={10} fill={palette.leaf} stroke={ink} strokeWidth={sw * 0.7} transform="rotate(-8 164 176)" />
        <Ellipse cx={56} cy={190} rx={10} ry={7} fill={palette.butter} stroke={ink} strokeWidth={sw * 0.7} />
        <Path d="M70 140 Q82 152 94 140" {...line} />
        <Path d="M126 140 Q138 152 150 140" {...line} />
        <Ellipse cx={62} cy={160} rx={11} ry={7} fill={palette.blush} />
        <Ellipse cx={158} cy={160} rx={11} ry={7} fill={palette.blush} />
        <Path d="M102 164 Q110 169 118 164" {...line} />
        {CRACKS.slice(0, Math.max(0, Math.min(3, crack))).map((d) => (
          <Path key={d} d={d} {...line} strokeWidth={sw * 1.3} strokeLinejoin="round" />
        ))}
        {face === "asleep" ? null : <Path d="M180 14 h15 l-15 17 h15" {...line} strokeWidth={sw * 1.3} />}
      </Svg>
    );
  }
  const s = SCALE[stage];
  const swe = sw / s;
  const border = 14 / s;
  const leaves = LEAVES.slice(0, LEAF_COUNT[stage]);
  const seeds = SEEDS.slice(0, SEED_COUNT[stage]);
  const body = (
    <>
      <Path d={BODY} fill={palette.ink} stroke={palette.ink} strokeWidth={border + swe * 2} strokeLinejoin="round" />
      {leaves.map((d, i) => (
        <Path key={i} d={d} fill={palette.ink} stroke={palette.ink} strokeWidth={border + swe * 2} strokeLinejoin="round" />
      ))}
    </>
  );
  return (
    <Svg width={size} height={h} viewBox="0 0 220 250">
      <G transform={`translate(110 228) scale(${s}) translate(-110 -228)`}>
        {shadow ? <G transform={`translate(${5 / s} ${5 / s})`}>{body}</G> : null}
        {body}
        <Path d={BODY} fill="#fff" stroke="#fff" strokeWidth={border} strokeLinejoin="round" />
        {leaves.map((d, i) => (
          <Path key={i} d={d} fill="#fff" stroke="#fff" strokeWidth={border} strokeLinejoin="round" />
        ))}
        <Path d={BODY} fill={FILL[stage]} stroke={palette.ink} strokeWidth={swe} strokeLinejoin="round" />
        {seeds.map(([x, y], i) => (
          <Ellipse
            key={i}
            cx={x}
            cy={y}
            rx={3.4}
            ry={5}
            fill={stage === "seed" ? palette.ink : palette.strawberryDeep}
            transform={`rotate(${(i % 3) * 14 - 14} ${x} ${y})`}
          />
        ))}
        <Path d="M52 98 C56 84 68 76 82 72" stroke="#fff" strokeOpacity={0.7} strokeWidth={6} strokeLinecap="round" fill="none" />
        {leaves.map((d, i) => (
          <Path key={i} d={d} fill={palette.leaf} stroke={palette.ink} strokeWidth={swe} strokeLinejoin="round" />
        ))}
        {stage === "big" ? <Flower sw={swe} /> : null}
        <Face face={face} blink={blink} sw={swe} />
      </G>
      {face === "love" ? (
        <>
          <G transform="translate(34 70) scale(1.2)">
            <Path d={HEART} fill={palette.strawberrySoft} stroke={palette.ink} strokeWidth={sw * 0.8} />
          </G>
          <G transform="translate(190 52) scale(0.9)">
            <Path d={HEART} fill={palette.strawberrySoft} stroke={palette.ink} strokeWidth={sw * 0.9} />
          </G>
        </>
      ) : null}
    </Svg>
  );
}

/** Dal umore del pet alla faccia da disegnare. */
export const faceForMood = (m: string): PetFace =>
  m === "away" || m === "egg" ? "asleep" : (m as PetFace);
