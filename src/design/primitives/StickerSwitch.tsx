import React, { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { haptics } from "@/lib/haptics";

import { useTheme } from "../ThemeProvider";
import { motion, outline } from "../tokens";

/**
 * Interruttore a adesivo: pillola con pallino. Il pallino scorre con una molla (solo transform), la pillola
 * cambia colore (leaf = acceso). Tick aptico. Target 44pt. Uso: <StickerSwitch value={on} onChange={setOn} label="Vibrazioni" />
 */
const W = 56;
const H = 32;
const KNOB = 22;

export function StickerSwitch({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.set(reduceMotion ? (value ? 1 : 0) : withSpring(value ? 1 : 0, motion.springSnappy));
  }, [value, reduceMotion, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * (W - KNOB - 10) }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => {
        haptics.tick();
        onChange(!value);
      }}
      style={{ width: W, height: H, minHeight: 44, justifyContent: "center" }}
    >
      <View
        style={{
          width: W,
          height: H,
          borderRadius: H / 2,
          backgroundColor: value ? colors.leaf : colors.blush,
          borderWidth: outline.width,
          borderColor: colors.outline,
          justifyContent: "center",
          paddingHorizontal: 3,
        }}
      >
        <Animated.View
          style={[
            {
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              backgroundColor: colors.surface,
              borderWidth: outline.width,
              borderColor: colors.outline,
            },
            knob,
          ]}
        />
      </View>
    </Pressable>
  );
}
