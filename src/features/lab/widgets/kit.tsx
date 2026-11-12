import React, { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Text as RNText, View, type ViewStyle } from "react-native";

import Svg, { Circle, Path } from "react-native-svg";

import { fonts, palette as P } from "@/design/tokens";

import { fitText } from "./fit";

/** Mattoncini per replicare i widget SwiftUI nell'anteprima web (stesse misure, stessi font, stessi testi). */
export const FONT = { display: fonts.display, heavy: fonts.bodyBold, semi: fonts.bodySemi } as const;
export type FontKey = keyof typeof FONT;

export function Box({
  fill,
  radius = 18,
  offset = 3,
  rotation = 0,
  style,
  children,
}: {
  fill: string;
  radius?: number;
  offset?: number;
  rotation?: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}) {
  return (
    <View style={[{ transform: [{ rotate: `${rotation}deg` }] }, style]}>
      <View
        style={{ position: "absolute", left: offset, top: offset, right: -offset, bottom: -offset, backgroundColor: P.ink, borderRadius: radius }}
      />
      <View style={{ backgroundColor: fill, borderRadius: radius, borderWidth: 2.5, borderColor: P.ink, flexGrow: 1 }}>{children}</View>
    </View>
  );
}

/** Testo con `lineLimit` e `minimumScaleFactor` simulati. `maxW` fisso, oppure larghezza del contenitore. */
export function WT({
  t,
  size,
  font = "semi",
  lines = 1,
  min = 1,
  maxW,
  tracking = 0,
  color = P.ink,
  align,
  flag,
}: {
  t: string;
  size: number;
  font?: FontKey;
  lines?: number;
  min?: number;
  maxW?: number;
  tracking?: number;
  color?: string;
  align?: "left" | "center";
  flag?: (msg: string) => void;
}) {
  const [w, setW] = useState(maxW ?? 0);
  const onLayout = (e: LayoutChangeEvent) => {
    if (maxW === undefined) setW(Math.floor(e.nativeEvent.layout.width));
  };
  const fam = FONT[font];
  const width = maxW ?? w;
  const f = width > 0 ? fitText(t, fam, size, width, lines, min, tracking) : null;
  useEffect(() => {
    if (f?.truncated) flag?.(`testo troncato: "${t}"`);
  }, [f?.truncated, t, flag]);
  return (
    <View onLayout={onLayout} style={maxW === undefined ? { alignSelf: "stretch" } : undefined}>
      {f ? (
        <RNText
          style={{
            fontFamily: fam,
            fontSize: f.size,
            lineHeight: Math.round(f.size * (font === "display" ? 1.05 : 1.18)),
            letterSpacing: tracking * f.scale,
            color,
            textAlign: align,
            fontWeight: "normal",
          }}
        >
          {f.lines.join("\n")}
        </RNText>
      ) : (
        <RNText style={{ fontFamily: fam, fontSize: size, opacity: 0, height: Math.round(size * 1.1) }}>{t}</RNText>
      )}
    </View>
  );
}

export function HeartGlyph({ size = 12, color = P.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="-13 -13 26 26">
      <Path d="M0 9 C-13 -1 -9 -13 0 -5.5 C9 -13 13 -1 0 9 Z" fill={color} />
    </Svg>
  );
}

function ClockGlyph({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={P.ink} strokeWidth={3} fill="none" />
      <Path d="M12 7 V12 L15.5 14" stroke={P.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function Pill({
  text,
  fill = P.butter,
  size = 12,
  heart = false,
  clock = false,
  rotation = 0,
  maxW = 130,
}: {
  text: string;
  fill?: string;
  size?: number;
  heart?: boolean;
  clock?: boolean;
  rotation?: number;
  maxW?: number;
}) {
  return (
    <Box fill={fill} radius={999} offset={2} rotation={rotation} style={{ alignSelf: "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
        {heart ? <HeartGlyph size={size - 1} /> : null}
        {clock ? <ClockGlyph size={size - 1} /> : null}
        <WT t={text} size={size} font="heavy" min={0.7} maxW={maxW - 18 - (heart || clock ? size + 2 : 0)} />
      </View>
    </Box>
  );
}

/** Cornice del widget: dimensioni di un iPhone X (iOS 16: nessun margine automatico, 16 pt a mano). Segnala overflow. */
export function Frame({
  w = 148,
  h = 148,
  pad = 16,
  confetti,
  children,
  report,
  label,
}: {
  w?: number;
  h?: number;
  pad?: number;
  confetti?: React.ReactNode;
  children: React.ReactNode;
  report?: (msg: string) => void;
  label: string;
}) {
  const ref = useRef<unknown>(null);
  useEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof node.scrollHeight !== "number") return;
    const t = setTimeout(() => {
      // tolleranza 5 pt: le ombre dure (2-4 pt) e le rotazioni escono dal riquadro ma restano nel margine
      if (node.scrollHeight > node.clientHeight + 5 || node.scrollWidth > node.clientWidth + 5)
        report?.(`${label}: contenuto più grande del riquadro (${node.scrollWidth}x${node.scrollHeight} > ${node.clientWidth}x${node.clientHeight})`);
    }, 400);
    return () => clearTimeout(t);
  });
  return (
    <View
      testID={`w-${label}`}
      style={{ width: w, height: h, borderRadius: 22, backgroundColor: P.paper, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" }}
    >
      {confetti}
      <View ref={ref as never} style={{ position: "absolute", left: pad - 1, top: pad - 1, right: pad - 1, bottom: pad - 1, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}
