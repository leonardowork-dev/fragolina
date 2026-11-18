import React, { useState } from "react";
import { View } from "react-native";

import { Button, Sticker, Text, useTheme } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { ConfirmSheet } from "@/features/pairing/ConfirmSheet";
import { S } from "@/lib/strings.it";

/**
 * Cornice comune dei tre giochi: indietro, titolo, avviso "è una prova" (solo prova), contenuto e "Lascia la partita".
 * Un solo elemento dominante per gioco: lo mette il figlio; qui ci sono solo i bordi.
 */
export function GameShell({
  title,
  onBack,
  practice,
  offline,
  onLeave,
  children,
}: {
  title: string;
  onBack: () => void;
  practice: boolean;
  offline: boolean;
  /** Se c'è, mostra "Lascia la partita" (partita aperta). */
  onLeave?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [ask, setAsk] = useState(false);
  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Button label={S.play.back} variant="ghost" onPress={onBack} haptic="tick" />
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {practice ? (
        <Sticker id="practice-banner" fill={colors.butterSoft} radius={18} offset={3} padding={12} tiltMax={0.8}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text variant="caption" color={colors.surface} style={{ fontSize: 12, lineHeight: 15 }}>
                {S.play.practice.badge}
              </Text>
            </View>
            <Text variant="caption" style={{ flex: 1 }}>
              {S.play.practice.banner}
            </Text>
          </View>
        </Sticker>
      ) : null}
      {offline && !practice ? (
        <Text variant="caption" color={colors.accentInk} accessibilityRole="alert">
          {S.play.offline}
        </Text>
      ) : null}
      {children}
      {onLeave ? <Button label={S.play.leave} variant="ghost" onPress={() => setAsk(true)} haptic="light" /> : null}
      <ConfirmSheet
        visible={ask}
        title={S.play.leaveAsk}
        body={S.play.leaveBody}
        confirmLabel={S.play.leaveYes}
        cancelLabel={S.play.leaveNo}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          onLeave?.();
        }}
      />
    </Screen>
  );
}
