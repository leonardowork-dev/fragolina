import React from "react";
import { View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

import { Sticker, Text, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { palette } from "@/design/tokens";
import { S } from "@/lib/strings.it";

/** Play: tre giochi teaser, ognuno con la sua forma e il suo disegno (non tre card uguali). */
const ink = palette.ink;

function TrisArt() {
  const l = { stroke: ink, strokeWidth: 5, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={128} height={128} viewBox="0 0 120 120">
      <Path d="M40 8 V112 M80 8 V112 M8 40 H112 M8 80 H112" {...l} />
      <Path d="M14 14 L34 34 M34 14 L14 34" {...l} stroke={palette.strawberry} strokeWidth={7} />
      <Circle cx={60} cy={60} r={13} {...l} stroke={palette.sky} strokeWidth={7} />
      <Path
        d="M86 86 L106 106 M106 86 L86 106"
        {...l}
        stroke={palette.strawberry}
        strokeWidth={7}
      />
    </Svg>
  );
}
function GuessArt() {
  return (
    <Svg width={96} height={96} viewBox="0 0 100 100">
      <Path
        d="M18 78 L24 56 L66 14 Q72 9 78 15 L86 23 Q91 29 86 35 L44 77 Z"
        fill={palette.butter}
        stroke={ink}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path d="M18 78 L24 56 L44 77 Z" fill={ink} />
      <Path
        d="M8 92 Q28 82 40 90 T72 88"
        stroke={palette.strawberry}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
function MemoryArt() {
  return (
    <Svg width={84} height={84} viewBox="0 0 100 100">
      <G transform="rotate(-8 30 50)">
        <Rect
          x={6}
          y={22}
          width={44}
          height={58}
          rx={9}
          fill={palette.leaf}
          stroke={ink}
          strokeWidth={4}
        />
        <Path
          d="M28 40 C21 46 20 54 28 62 C36 54 35 46 28 40 Z"
          fill={palette.paper}
          stroke={ink}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </G>
      <G transform="rotate(9 70 50)">
        <Rect
          x={48}
          y={18}
          width={44}
          height={58}
          rx={9}
          fill={palette.blush}
          stroke={ink}
          strokeWidth={4}
        />
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

function SoonTag() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.ink,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text variant="caption" color={colors.surface} style={{ fontSize: 13, lineHeight: 16 }}>
        {S.play.soon}
      </Text>
    </View>
  );
}

export function PlayScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const soon = () => toast.show(S.play.toast);
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {S.play.title}
      </Text>
      <Sticker
        id="tris"
        fill={colors.butter}
        radius={32}
        offset={6}
        padding={22}
        tiltMax={1.5}
        onPress={soon}
        faceStyle={{ minHeight: 210, justifyContent: "center" }}
        accessibilityLabel={`${S.play.tris.name}. ${S.play.tris.line}`}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <SoonTag />
            <Text
              variant="display"
              style={{ fontSize: 30, lineHeight: 30 }}
              maxFontSizeMultiplier={1.25}
            >
              {S.play.tris.name}
            </Text>
            <Text variant="body">{S.play.tris.line}</Text>
          </View>
          <TrisArt />
        </View>
      </Sticker>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <Sticker
          id="indovina"
          fill={colors.sky}
          radius={26}
          offset={5}
          padding={16}
          tiltMax={2}
          onPress={soon}
          style={{ flex: 1.2 }}
          faceStyle={{ minHeight: 270 }}
          accessibilityLabel={`${S.play.guess.name}. ${S.play.guess.line}`}
        >
          <View style={{ gap: 8, alignItems: "flex-start" }}>
            <GuessArt />
            <Text variant="title" style={{ fontSize: 22, lineHeight: 23 }}>
              {S.play.guess.name}
            </Text>
            <Text variant="caption">{S.play.guess.line}</Text>
          </View>
        </Sticker>
        <Sticker
          id="memory"
          fill={colors.blush}
          radius={26}
          offset={5}
          padding={14}
          tiltMax={2.5}
          onPress={soon}
          style={{ flex: 1, marginTop: 40 }}
          faceStyle={{ minHeight: 230 }}
          accessibilityLabel={`${S.play.memory.name}. ${S.play.memory.line}`}
        >
          <View style={{ gap: 8, alignItems: "flex-start" }}>
            <MemoryArt />
            <Text variant="title" style={{ fontSize: 20, lineHeight: 21 }}>
              {S.play.memory.name}
            </Text>
            <Text variant="caption" style={{ fontSize: 14, lineHeight: 18 }}>
              {S.play.memory.line}
            </Text>
          </View>
        </Sticker>
      </View>
      <Text variant="body">{S.play.body}</Text>
    </Screen>
  );
}
