import React from "react";
import { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

import type { Outfit } from "@/lib/pet/rules";

import { palette } from "../tokens";

/**
 * Vestiti e accessori ORIGINALI del pet (Sticker Book: riempimenti piatti, contorno ink). Disegnati nel sistema di
 * coordinate di PetArt (220×250, occhi a (80,126) e (140,126), bocca a (110,155)): vanno dentro il gruppo scalato
 * dallo stadio, così crescono con lui. `OutfitBack` = dietro il corpo (mantellina), `OutfitFront` = sopra.
 * Sono forme semplici: nessuna emoji, nessun personaggio esistente.
 */
const INK = palette.ink;

export function OutfitBack({ outfit, sw }: { outfit?: Outfit; sw: number }) {
  if (outfit?.body !== "cape") return null;
  return (
    <Path d="M52 150 C34 190 30 226 44 240 L110 232 L176 240 C190 226 186 190 168 150 Z" fill={palette.strawberryDeep} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
  );
}

export function OutfitFront({ outfit, sw }: { outfit?: Outfit; sw: number }) {
  if (!outfit) return null;
  return (
    <G>
      {outfit.body === "sweater" ? (
        <G>
          <Path d="M58 196 C80 208 140 208 162 196 L168 222 C140 234 80 234 52 222 Z" fill={palette.sky} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M56 210 C84 222 136 222 164 210" fill="none" stroke={palette.white} strokeWidth={sw * 1.6} />
        </G>
      ) : null}
      {outfit.body === "tutu" ? (
        <G>
          <Path d="M48 214 C60 232 160 232 172 214 C150 206 70 206 48 214 Z" fill={palette.blush} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M62 218 L58 230 M86 222 L84 233 M110 223 L110 234 M134 222 L136 233 M158 218 L162 230" stroke={INK} strokeWidth={sw * 0.8} strokeLinecap="round" />
        </G>
      ) : null}
      {outfit.neck === "scarf" ? (
        <G>
          <Path d="M54 184 C84 200 136 200 166 184 L168 198 C138 214 82 214 52 198 Z" fill={palette.strawberry} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M138 204 L148 236 L126 232 L128 206 Z" fill={palette.strawberry} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M64 192 L150 206" stroke={palette.white} strokeWidth={sw * 1.2} strokeLinecap="round" strokeDasharray="6 10" />
        </G>
      ) : null}
      {outfit.neck === "bowtie" ? (
        <G>
          <Path d="M110 192 L84 178 L84 206 Z" fill={palette.leaf} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M110 192 L136 178 L136 206 Z" fill={palette.leaf} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={110} cy={192} r={7} fill={palette.butter} stroke={INK} strokeWidth={sw} />
        </G>
      ) : null}
      {outfit.neck === "pearls" ? (
        <G>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const x = 58 + i * 17.3;
            const y = 188 + Math.sin((i / 6) * Math.PI) * 16;
            return <Circle key={i} cx={x} cy={y} r={6.2} fill={palette.white} stroke={INK} strokeWidth={sw * 0.8} />;
          })}
        </G>
      ) : null}
      {outfit.eyes === "shades" ? (
        <G>
          <Rect x={60} y={112} width={40} height={30} rx={13} fill={INK} />
          <Rect x={120} y={112} width={40} height={30} rx={13} fill={INK} />
          <Path d="M100 122 L120 122" stroke={INK} strokeWidth={sw * 1.5} />
          <Path d="M66 118 L78 118 M126 118 L138 118" stroke={palette.white} strokeWidth={sw} strokeLinecap="round" opacity={0.7} />
        </G>
      ) : null}
      {outfit.eyes === "round" ? (
        <G fill="none" stroke={INK} strokeWidth={sw * 1.3}>
          <Circle cx={80} cy={126} r={21} fill={palette.skySoft} fillOpacity={0.35} />
          <Circle cx={140} cy={126} r={21} fill={palette.skySoft} fillOpacity={0.35} />
          <Path d="M101 124 Q110 116 119 124" />
          <Path d="M59 124 L46 118 M161 124 L174 118" strokeLinecap="round" />
        </G>
      ) : null}
      {outfit.head === "cap" ? (
        <G>
          <Path d="M54 74 C56 30 164 30 166 74 Z" fill={palette.strawberry} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M54 74 C82 84 124 84 146 76 L176 82 C150 96 82 96 54 74 Z" fill={palette.strawberryDeep} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={110} cy={30} r={6} fill={palette.butter} stroke={INK} strokeWidth={sw * 0.8} />
        </G>
      ) : null}
      {outfit.head === "bow" ? (
        <G>
          <Path d="M150 56 L124 40 L124 72 Z" fill={palette.blush} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M150 56 L176 40 L176 72 Z" fill={palette.blush} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={150} cy={56} r={8} fill={palette.strawberry} stroke={INK} strokeWidth={sw} />
        </G>
      ) : null}
      {outfit.head === "phones" ? (
        <G>
          <Path d="M46 124 C40 40 180 40 174 124" fill="none" stroke={INK} strokeWidth={sw * 2.4} strokeLinecap="round" />
          <Path d="M46 124 C40 40 180 40 174 124" fill="none" stroke={palette.sky} strokeWidth={sw * 1.2} strokeLinecap="round" />
          <Rect x={30} y={110} width={26} height={42} rx={12} fill={palette.butter} stroke={INK} strokeWidth={sw} />
          <Rect x={164} y={110} width={26} height={42} rx={12} fill={palette.butter} stroke={INK} strokeWidth={sw} />
        </G>
      ) : null}
      {outfit.head === "flowers" ? (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const x = 56 + i * 27;
            const y = 62 - Math.sin((i / 4) * Math.PI) * 22;
            const c = [palette.blush, palette.butter, palette.strawberrySoft, palette.butter, palette.blush][i]!;
            return (
              <G key={i}>
                {[0, 72, 144, 216, 288].map((a) => (
                  <Ellipse key={a} cx={x} cy={y - 8} rx={4.6} ry={7} fill={c} stroke={INK} strokeWidth={sw * 0.7} transform={`rotate(${a} ${x} ${y})`} />
                ))}
                <Circle cx={x} cy={y} r={4} fill={palette.strawberry} stroke={INK} strokeWidth={sw * 0.6} />
              </G>
            );
          })}
        </G>
      ) : null}
      {outfit.head === "chef" ? (
        <G>
          <Path d="M64 74 C40 66 44 30 72 36 C76 8 112 8 118 30 C142 14 170 36 154 62 C176 66 168 80 156 74 Z" fill={palette.white} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
          <Rect x={62} y={68} width={96} height={16} rx={6} fill={palette.white} stroke={INK} strokeWidth={sw} />
        </G>
      ) : null}
      {outfit.head === "halo" ? (
        <G>
          <Ellipse cx={110} cy={26} rx={44} ry={11} fill="none" stroke={INK} strokeWidth={sw * 3} />
          <Ellipse cx={110} cy={26} rx={44} ry={11} fill="none" stroke={palette.butter} strokeWidth={sw * 1.6} />
        </G>
      ) : null}
    </G>
  );
}
