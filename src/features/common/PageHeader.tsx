import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Icon, StickerPressable, Text, useTheme } from "@/design";
import { outline } from "@/design/tokens";
import { S } from "@/lib/strings.it";

/** Intestazione delle pagine che non sono tab: adesivo tondo "indietro" + titolo grande. Il tocco indietro è anche lo swipe di sistema. */
export function PageHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <StickerPressable
          accessibilityLabel={S.common.back}
          haptic="light"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.butter,
            borderWidth: outline.width,
            borderColor: colors.outline,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="back" size={26} />
        </StickerPressable>
        {right}
      </View>
      <Text variant="display" accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
        {title}
      </Text>
    </View>
  );
}
