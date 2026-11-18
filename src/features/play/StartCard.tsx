import React from "react";
import { View } from "react-native";

import { Button, Sticker, Text, useTheme } from "@/design";
import type { GameKind } from "@/lib/games/types";
import { S } from "@/lib/strings.it";

import { DrawArt, QuizArt, TrisArt } from "./art";

export const GAME_FILL = (c: ReturnType<typeof useTheme>["colors"], k: GameKind) =>
  k === "tris" ? c.butter : k === "quiz" ? c.sky : c.blush;

export function GameArt({ kind, size }: { kind: GameKind; size: number }) {
  return kind === "tris" ? <TrisArt size={size} /> : kind === "quiz" ? <QuizArt size={size} /> : <DrawArt size={size} />;
}

/** Quando non c'è ancora una partita: cos'è il gioco e un solo pulsante per iniziare. */
export function StartCard({ kind, onStart, disabled }: { kind: GameKind; onStart: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Sticker id={`start-${kind}`} fill={GAME_FILL(colors, kind)} radius={28} offset={6} padding={20} tiltMax={1.5}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="title">{S.play.games[kind].name}</Text>
            <Text variant="body">{S.play.games[kind].line}</Text>
          </View>
          <GameArt kind={kind} size={92} />
        </View>
        <Button label={S.play.start} onPress={onStart} disabled={disabled} haptic="medium" />
      </View>
    </Sticker>
  );
}
