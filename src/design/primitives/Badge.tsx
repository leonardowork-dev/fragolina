import React from "react";
import { View } from "react-native";

import { useTheme } from "../ThemeProvider";
import { outline } from "../tokens";
import { Text } from "./Text";

/** Badge: pallino con un numero (conteggi). Mai sopra i titoli. Uso: <Badge value={3} /> */
export function Badge({ value, fill }: { value: number | string; fill?: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={String(value)}
      style={{
        minWidth: 28,
        height: 28,
        paddingHorizontal: 7,
        borderRadius: 14,
        backgroundColor: fill ?? colors.butter,
        borderWidth: outline.width,
        borderColor: colors.outline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="caption" style={{ fontSize: 14, lineHeight: 16 }} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
    </View>
  );
}
