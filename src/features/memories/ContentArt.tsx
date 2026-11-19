import React from "react";
import { View } from "react-native";

import { Text, useTheme } from "@/design";
import { fonts, outline, palette } from "@/design/tokens";
import { type NoteContent, isDraw, textInkFor } from "@/lib/note/rules";

import { BG_HEX, NoteDrawingSvg } from "../draw/NoteArt";

/** Un biglietto o un disegno in un quadrato con contorno (nell'album e nei ricordi tenuti). */
export function ContentArt({ content, size }: { content: NoteContent; size: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        borderWidth: outline.width,
        borderColor: colors.outline,
        backgroundColor: isDraw(content) ? colors.white : BG_HEX[content.bg],
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {isDraw(content) ? (
        <NoteDrawingSvg strokes={content.strokes} size={size - outline.width * 2} />
      ) : (
        <Text variant="caption" numberOfLines={5} color={palette[textInkFor(content.bg)]} style={{ padding: 8, fontFamily: fonts.display }}>
          {content.text}
        </Text>
      )}
    </View>
  );
}
