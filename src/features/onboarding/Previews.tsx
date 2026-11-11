import React from "react";
import { View } from "react-native";

import { Icon, MoodSticker, Sticker, Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import type { MoodId } from "@/features/home/moods";

/** Piccole anteprime "vere" per riempire gli schermi di benvenuto con sostanza, non con ornamenti. */

export function WelcomeCluster() {
  const { colors } = useTheme();
  return (
    <View
      style={{ height: 210, width: "100%" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ position: "absolute", left: 0, top: 18 }}>
        <Sticker id="wc-1" fill={colors.accent} radius={26} offset={5} padding={16} tiltMax={3}>
          <View style={{ gap: 4 }}>
            <Icon name="heart" size={30} fill={colors.butter} />
            <Text variant="title">{S.home.thinkTitle}</Text>
          </View>
        </Sticker>
      </View>
      <View style={{ position: "absolute", right: 6, top: 0 }}>
        <Sticker id="wc-2" fill={colors.sky} radius={34} offset={5} padding={12} tiltMax={4}>
          <MoodSticker mood="coccole" size={78} />
        </Sticker>
      </View>
      <View style={{ position: "absolute", left: 70, top: 122 }}>
        <Sticker id="wc-3" fill={colors.butter} radius={22} offset={4} padding={14} tiltMax={4}>
          <Text
            variant="display"
            style={{ fontSize: 34, lineHeight: 34 }}
            maxFontSizeMultiplier={1.1}
          >
            {S.home.daysTitle}
          </Text>
        </Sticker>
      </View>
    </View>
  );
}

export function WidgetMock({
  partner,
  mood,
  days,
}: {
  partner: string;
  mood: MoodId;
  days: number;
}) {
  const { colors } = useTheme();
  return (
    <Sticker
      id="wm"
      fill={colors.ground}
      radius={30}
      offset={5}
      padding={14}
      tiltMax={1.5}
      style={{ alignSelf: "flex-start" }}
    >
      <View
        style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
        accessibilityLabel={`${S.home.daysTitle}: ${days}`}
      >
        <Sticker id="wm-a" fill={colors.butter} radius={20} offset={3} padding={10} tiltMax={2}>
          <View style={{ alignItems: "center", gap: 2 }}>
            <MoodSticker mood={mood} size={56} />
            <Text
              variant="caption"
              style={{ fontSize: 13, lineHeight: 15 }}
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
            >
              {partner}
            </Text>
          </View>
        </Sticker>
        <View>
          <Text
            variant="display"
            style={{ fontSize: 48, lineHeight: 48 }}
            maxFontSizeMultiplier={1.1}
          >
            {days}
          </Text>
          <Text variant="caption" style={{ fontWeight: "800" }}>
            {S.home.daysTitle.toLowerCase()}
          </Text>
        </View>
      </View>
    </Sticker>
  );
}
