import React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";

import { useTheme } from "../ThemeProvider";
import { type TypeVariant, type, fonts } from "../tokens";

/**
 * Testo del sistema. Varianti: hero / display / title (Bagel Fat One) e body / bodyStrong / caption (Figtree).
 * Dynamic Type attivo: il display è limitato a 1.35x per non rompere i layout, il corpo a 2x.
 * Il testo corrente è sempre inchiostro pieno, 16pt+ (caption 15pt).
 * Uso: <Text variant="title">Ciao</Text>
 */
export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  /** Colore: token del tema o stringa. Di base inchiostro. */
  color?: string;
  align?: TextStyle["textAlign"];
};

const DISPLAY: TypeVariant[] = ["hero", "display", "title"];

export function Text({ variant = "body", color, align, style, children, ...rest }: TextProps) {
  const { colors } = useTheme();
  const t = type[variant];
  const isDisplay = DISPLAY.includes(variant);
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={isDisplay ? 1.35 : 2}
      {...rest}
      style={[
        {
          fontFamily: t.family,
          fontSize: t.size,
          lineHeight: Math.round(t.size * t.line),
          letterSpacing: t.size * t.tracking,
          color: color ?? colors.ink,
          textAlign: align,
          // Bagel è già pesante: evita il faux-bold del sistema.
          fontWeight: t.family === fonts.display ? "normal" : undefined,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
