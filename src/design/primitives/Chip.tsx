import React from "react";

import { useTheme } from "../ThemeProvider";
import { radius } from "../tokens";
import { Sticker } from "./Sticker";
import { Text } from "./Text";

/**
 * Chip: piccolo adesivo selezionabile (fragola quando attivo). Selezione = tick aptico.
 * Uso: <Chip label="Pizza" selected onPress={…} />
 */
export type ChipProps = { label: string; selected?: boolean; onPress?: () => void; id?: string };

export function Chip({ label, selected, onPress, id }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Sticker
      id={id ?? `chip-${label}`}
      fill={selected ? colors.accent : colors.surface}
      radius={radius.round}
      offset={3}
      padding={0}
      tiltMax={1.5}
      onPress={onPress}
      haptic="tick"
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text variant="caption" style={{ paddingHorizontal: 16, paddingVertical: 11, minHeight: 44 }} color={colors.ink}>
        {label}
      </Text>
    </Sticker>
  );
}
