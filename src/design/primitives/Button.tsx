import React from "react";
import { type GestureResponderEvent, View } from "react-native";

import { useTheme } from "../ThemeProvider";
import { radius } from "../tokens";
import { Icon, type IconName } from "../icons/Icon";
import { StickerPressable } from "./Pressable";
import { Sticker } from "./Sticker";
import { Text } from "./Text";

/**
 * Bottone. primary = fragola (testo inchiostro, 4.90:1), secondary = carta con contorno, ghost = solo testo.
 * Altezza minima 52pt (target ≥ 44). Uso: <Button label="Entra" onPress={…} />
 */
export type ButtonProps = {
  id?: string;
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  disabled?: boolean;
  haptic?: "tick" | "light" | "medium" | "success";
  accessibilityHint?: string;
  fullWidth?: boolean;
};

export function Button({ id, label, onPress, variant = "primary", icon, disabled, haptic = "light", accessibilityHint, fullWidth }: ButtonProps) {
  const { colors } = useTheme();

  if (variant === "ghost") {
    return (
      <StickerPressable
        onPress={onPress}
        disabled={disabled}
        haptic={haptic}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8, alignSelf: fullWidth ? "stretch" : "flex-start", opacity: disabled ? 0.45 : 1 }}
      >
        <Text variant="bodyStrong" color={colors.accentInk}>
          {label}
        </Text>
      </StickerPressable>
    );
  }

  const fill = variant === "primary" ? colors.accent : colors.surface;
  return (
    <Sticker
      id={id ?? `btn-${label}`}
      fill={fill}
      radius={radius.round}
      offset={4}
      padding={0}
      tiltMax={1}
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={{ alignSelf: fullWidth ? "stretch" : "flex-start", opacity: disabled ? 0.45 : 1 }}
    >
      <View style={{ minHeight: 52, paddingHorizontal: 24, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {icon ? <Icon name={icon} size={22} fill={variant === "primary" ? colors.butter : colors.blush} /> : null}
        <Text variant="bodyStrong" color={variant === "primary" ? colors.accentText : colors.ink}>
          {label}
        </Text>
      </View>
    </Sticker>
  );
}
