import React from "react";
import { View } from "react-native";

import { Mascot } from "../mascot/Mascot";
import type { MascotMood } from "../mascot/useMascot";
import { Button } from "./Button";
import { Text } from "./Text";

/**
 * Stato vuoto con la mascotte: titolo, spiegazione, azione opzionale. Allineato a sinistra.
 * Uso: <EmptyState mood="sleepy" title="…" body="…" actionLabel="…" onAction={…} />
 */
export type EmptyStateProps = { mood?: MascotMood; title: string; body: string; actionLabel?: string; onAction?: () => void };

export function EmptyState({ mood = "sleepy", title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ gap: 12, alignItems: "flex-start" }}>
      <Mascot size={112} mood={mood} />
      <Text variant="display">{title}</Text>
      <Text variant="body">{body}</Text>
      {actionLabel ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}
