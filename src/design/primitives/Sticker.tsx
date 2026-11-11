import React from "react";
import {
  Pressable as RNPressable,
  type StyleProp,
  View,
  type ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import Animated from "react-native-reanimated";

import { tiltFor } from "@/lib/hash";

import { useTheme } from "../ThemeProvider";
import { outline, radius as radii, shadowOffset } from "../tokens";
import { type HapticKind, usePressFeedback } from "./Pressable";

/**
 * Sticker: la base di tutto. Fill piatto + contorno 2.5px + ombra dura (copia piena, offset giù-destra,
 * niente blur) + inclinazione deterministica per `id` (-2°…+2°).
 * Con `onPress` diventa premibile: la FACCIA scivola dentro la sua ombra, che resta ferma.
 * Uso: <Sticker id="penso-a-te" fill={colors.accent} onPress={…}>…</Sticker>
 */
export type StickerProps = {
  id: string;
  children?: React.ReactNode;
  fill?: string;
  /** Raggio degli angoli. */
  radius?: number;
  /** Offset ombra dura in px. 0 = nessuna ombra. */
  offset?: number;
  /** Disattiva contorno (di rado: la carta non ha contorno, gli adesivi sì). */
  noOutline?: boolean;
  /** Inclinazione massima in gradi (di base 2). 0 = dritto. */
  tiltMax?: number;
  padding?: number;
  onPress?: (e: GestureResponderEvent) => void;
  haptic?: HapticKind;
  /** Scala dello stato premuto (di base 0.97; il bottone eroe usa 0.95). */
  pressScale?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "none" | "text" | "header" | "image";
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  /** Overflow visibile della faccia (per elementi che sbordano, es. la mascotte). */
  overflowVisible?: boolean;
  testID?: string;
};

export function Sticker(props: StickerProps) {
  const {
    id,
    children,
    fill,
    radius = radii.lg,
    offset = shadowOffset.md,
    noOutline,
    tiltMax = 2,
    padding = 16,
    onPress,
    haptic = "light",
    pressScale,
    disabled,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole,
    style,
    faceStyle: faceStyleProp,
    overflowVisible,
    testID,
  } = props;
  const { colors } = useTheme();
  const { faceStyle, pressProps } = usePressFeedback({ offset, haptic, onPress, pressScale });
  const rotate = `${tiltFor(id, tiltMax)}deg`;
  const interactive = !!onPress && !disabled;

  const face = (
    <>
      {offset > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: offset,
            left: offset,
            right: -offset,
            bottom: -offset,
            borderRadius: radius,
            backgroundColor: colors.shadow,
          }}
        />
      ) : null}
      <Animated.View
        style={[
          {
            backgroundColor: fill ?? colors.surface,
            borderRadius: radius,
            borderWidth: noOutline ? 0 : outline.width,
            borderColor: colors.outline,
            padding,
            overflow: overflowVisible ? "visible" : "hidden",
          },
          interactive ? faceStyle : null,
          faceStyleProp,
        ]}
      >
        {children}
      </Animated.View>
    </>
  );

  const wrapperStyle: StyleProp<ViewStyle> = [{ transform: [{ rotate }] }, style];

  if (!interactive) {
    return (
      <View
        style={wrapperStyle}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole}
      >
        {face}
      </View>
    );
  }
  return (
    <RNPressable
      testID={testID}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
      style={wrapperStyle}
      {...pressProps}
    >
      {face}
    </RNPressable>
  );
}
