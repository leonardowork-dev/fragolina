import React from "react";
import { View } from "react-native";

import { Sticker, StickerPressable, Text, useTheme } from "@/design";
import { palette } from "@/design/tokens";
import { levelProgress } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

/** Livello, barra dei punti e il tasto del guardaroba (adesivo, non una barra qualsiasi). */
export function PetLevel({ xp, onWardrobe }: { xp: number; onWardrobe: () => void }) {
  const { colors } = useTheme();
  const lp = levelProgress(xp);
  const frac = lp.to === null ? 1 : (xp - lp.from) / (lp.to - lp.from);
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "stretch" }}>
      <Sticker id="pet-livello" fill={colors.leafSoft} radius={24} offset={4} padding={12} tiltMax={1} style={{ flex: 1 }} accessibilityRole="text" accessibilityLabel={S.pet.level2.a11y(lp.level, xp, lp.to)}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <Text variant="title">{S.pet.level2.label(lp.level)}</Text>
            <Text variant="caption">{lp.to === null ? S.pet.level2.max : S.pet.level2.points(xp, lp.to)}</Text>
          </View>
          <View style={{ height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: palette.ink, backgroundColor: palette.white, overflow: "hidden" }}>
            <View style={{ width: `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`, height: "100%", backgroundColor: palette.strawberry }} />
          </View>
        </View>
      </Sticker>
      <StickerPressable accessibilityLabel={S.pet.wardrobe.open} haptic="light" onPress={onWardrobe} style={{ minWidth: 92, borderRadius: 24, borderWidth: 2.5, borderColor: palette.ink, backgroundColor: palette.butter, alignItems: "center", justifyContent: "center", padding: 8 }}>
        <Text variant="bodyStrong" align="center">{S.pet.wardrobe.open}</Text>
      </StickerPressable>
    </View>
  );
}
