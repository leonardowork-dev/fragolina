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
  multiline = false,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  placeholder?: string;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Più righe (risposte lunghe). */
  multiline?: boolean;
  minHeight?: number;
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
        autoCorrect={multiline}
        returnKeyType={multiline ? "default" : "done"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 17,
          minHeight: minHeight ?? 52,
          paddingHorizontal: 16,
          paddingVertical: multiline ? 12 : 0,
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
