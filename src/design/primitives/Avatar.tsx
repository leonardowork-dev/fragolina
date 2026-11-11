import React from "react";
import { View } from "react-native";

import { useTheme } from "../ThemeProvider";
import { Sticker } from "./Sticker";
import { Text } from "./Text";

/** Avatar: adesivo tondo con l'iniziale. Uso: <Avatar name="Nikole" size={48} fill={colors.sky} /> */
export function Avatar({ name, size = 48, fill }: { name: string; size?: number; fill?: string }) {
  const { colors } = useTheme();
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <Sticker id={`avatar-${name}`} fill={fill ?? colors.butter} radius={size} offset={3} padding={0} tiltMax={3} accessibilityLabel={name} accessibilityRole="image">
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text variant="title" style={{ fontSize: size * 0.48, lineHeight: size * 0.52 }} maxFontSizeMultiplier={1.1}>
          {initial}
        </Text>
      </View>
    </Sticker>
  );
}
