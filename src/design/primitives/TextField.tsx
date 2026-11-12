import React from "react";
import { TextInput, View } from "react-native";

import { useTheme } from "../ThemeProvider";
import { fonts, outline } from "../tokens";
import { Text } from "./Text";

/** Campo di testo del sistema: etichetta sopra, riquadro blush con contorno, errore sotto. Massimo 24 caratteri di base. */
export function TextField({
  label,
  value,
  onChange,
  error,
  placeholder,
  maxLength = 24,
  autoCapitalize = "words",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  placeholder?: string;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={colors.ink + "66"}
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="done"
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 17,
          minHeight: 52,
          paddingHorizontal: 16,
          color: colors.ink,
          backgroundColor: colors.blushSoft,
          borderRadius: 16,
          borderWidth: outline.width,
          borderColor: error ? colors.accentInk : colors.outline,
        }}
      />
      {error ? (
        <Text variant="caption" color={colors.accentInk}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
