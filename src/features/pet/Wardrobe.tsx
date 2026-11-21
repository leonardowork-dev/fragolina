import React from "react";
import { View } from "react-native";

import { Button, Sheet, Sticker, Text, useTheme } from "@/design";
import { PetArt } from "@/design/mascot/PetArt";
import { OUTFIT_ITEMS, OUTFIT_SLOTS, type Outfit, type OutfitSlot, levelOf } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";

/** Guardaroba: per ogni posto (testa, occhi, collo, corpo) gli indumenti sbloccati dal livello; gli altri dicono da che livello. */
export function Wardrobe({ visible, onClose, xp, outfit, onChange }: { visible: boolean; onClose: () => void; xp: number; outfit: Outfit; onChange: (o: Outfit) => void }) {
  const { colors } = useTheme();
  const lvl = levelOf(xp);
  const set = (slot: OutfitSlot, id: string | null) => onChange({ ...outfit, [slot]: id });
  return (
    <Sheet visible={visible} onClose={onClose} title={S.pet.wardrobe.title}>
      <View style={{ gap: 14, marginTop: 8 }}>
        <Text variant="caption">{S.pet.wardrobe.hint}</Text>
        {OUTFIT_SLOTS.map((slot) => (
          <View key={slot} style={{ gap: 8 }}>
            <Text variant="bodyStrong">{S.pet.wardrobe.slots[slot]}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              <Sticker id={`w-${slot}-none`} fill={!outfit[slot] ? colors.accent : colors.surface} radius={18} offset={3} padding={8} tiltMax={1} onPress={() => set(slot, null)} haptic="tick" accessibilityLabel={`${S.pet.wardrobe.slots[slot]}: ${S.pet.wardrobe.none}`}>
                <View style={{ width: 70, height: 84, alignItems: "center", justifyContent: "center" }}>
                  <Text variant="caption" align="center">{S.pet.wardrobe.none}</Text>
                </View>
              </Sticker>
              {OUTFIT_ITEMS.filter((i) => i.slot === slot).map((i) => {
                const open = i.level <= lvl;
                const on = outfit[slot] === i.id;
                return (
                  <Sticker key={i.id} id={`w-${slot}-${i.id}`} fill={on ? colors.accent : open ? colors.surface : colors.blushSoft} radius={18} offset={open ? 3 : 0} padding={6} tiltMax={1} onPress={open ? () => set(slot, i.id) : undefined} haptic="tick" accessibilityLabel={open ? S.pet.wardrobe.items[i.id] : `${S.pet.wardrobe.items[i.id]}: ${S.pet.wardrobe.locked(i.level)}`} style={{ opacity: open ? 1 : 0.55 }}>
                    <View style={{ width: 70, alignItems: "center", gap: 2 }}>
                      <PetArt stage="big" face="happy" size={58} shadow={false} outfit={{ [slot]: i.id }} />
                      <Text variant="caption" align="center" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{open ? S.pet.wardrobe.items[i.id] : S.pet.wardrobe.locked(i.level)}</Text>
                    </View>
                  </Sticker>
                );
              })}
            </View>
          </View>
        ))}
        <Button label={S.pet.wardrobe.close} variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}
