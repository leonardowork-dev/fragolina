import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";

import { useTheme } from "../ThemeProvider";
import { motion, outline } from "../tokens";
import { Text } from "./Text";

/**
 * Sheet: pannello dal basso, trascinabile. Scrim piatto (niente blur). Chiusura per VELOCITÀ o per
 * proiezione (non solo distanza: basta un colpo di dito). Rubber-band oltre il bordo alto.
 * Molla di apertura { duration: 300, dampingRatio: 0.8 }, con la velocità del rilascio.
 * Altezza = contenuto misurato (Dynamic Type safe), mai fissa. "Meno movimento": solo dissolvenza.
 * Uso: <Sheet visible={open} onClose={() => setOpen(false)} title="…">…</Sheet>
 */
export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

function rubber(d: number, dim = 140) {
  "worklet";
  return (1 - 1 / ((d * 0.55) / dim + 1)) * dim;
}

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors, reduceMotion } = useTheme();
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(winH);
  const startY = useSharedValue(0);
  const fade = useSharedValue(0);
  const heightSv = useSharedValue(300);

  const finishClose = useCallback(() => {
    onClose();
    setMounted(false);
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- monta il Modal prima di animare l'ingresso
      setMounted(true);
      if (reduceMotion) {
        y.set(0);
        fade.set(withTiming(1, { duration: 160 }));
      } else {
        fade.set(1);
        y.set(withSpring(0, motion.springSheet));
      }
    } else if (mounted) {
      if (reduceMotion) {
        fade.set(
          withTiming(0, { duration: 140 }, (done) => {
            if (done) scheduleOnRN(setMounted, false);
          }),
        );
      } else {
        y.set(
          withTiming(winH, { duration: 200, easing: motion.easeOut }, (done) => {
            if (done) scheduleOnRN(setMounted, false);
          }),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      startY.set(y.get());
    })
    .onUpdate((e) => {
      const ty = startY.get() + e.translationY;
      y.set(ty < 0 ? -rubber(-ty) : ty);
    })
    .onEnd((e) => {
      const projected = y.get() + e.velocityY * 0.25;
      if (projected > heightSv.get() * 0.5 || e.velocityY > 900) {
        y.set(
          withTiming(winH, { duration: 200, easing: motion.easeOut }, (done) => {
            if (done) scheduleOnRN(finishClose);
          }),
        );
        scheduleOnRN(haptics.light);
      } else {
        y.set(withSpring(0, { ...motion.springSheet, velocity: e.velocityY }));
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? fade.get()
      : interpolate(y.get(), [0, winH * 0.6], [1, 0], Extrapolation.CLAMP),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(y.get(), -200) }],
    opacity: reduceMotion ? fade.get() : 1,
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: colors.scrim,
            },
            scrimStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={S.common.close}
            style={{ flex: 1 }}
            onPress={onClose}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <GestureDetector gesture={pan}>
            <Animated.View
              accessibilityViewIsModal
              onLayout={(e) => heightSv.set(e.nativeEvent.layout.height)}
              style={[
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  borderWidth: outline.width,
                  borderBottomWidth: 0,
                  borderColor: colors.outline,
                  paddingTop: 10,
                  paddingHorizontal: 20,
                  paddingBottom: insets.bottom + 24,
                  maxHeight: winH * 0.92,
                },
                panelStyle,
              ]}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: -outline.width,
                  right: -outline.width,
                  top: "100%",
                  height: 240,
                  backgroundColor: colors.surface,
                  borderLeftWidth: outline.width,
                  borderRightWidth: outline.width,
                  borderColor: colors.outline,
                }}
              />
              <View
                style={{
                  alignSelf: "center",
                  width: 48,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.ink,
                  marginBottom: 14,
                }}
              />
              {title ? (
                <Text variant="display" accessibilityRole="header" style={{ marginBottom: 6 }}>
                  {title}
                </Text>
              ) : null}
              {children}
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
