import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { useTheme } from "../ThemeProvider";
import { Icon } from "../icons/Icon";
import { motion } from "../tokens";
import { Sticker } from "./Sticker";
import { Text } from "./Text";

/**
 * Toast: adesivo che entra dall'alto con una molla (300ms), sparisce da solo dopo ~2.8s o con uno swipe verso l'alto
 * (velocità o distanza). Uno alla volta. Uso: const toast = useToast(); toast.show("Salvato");
 * Provider da montare nella radice: <ToastProvider>.
 */
type Ctx = { show: (text: string) => void };
const ToastContext = createContext<Ctx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastItem({ text, onGone }: { text: string; onGone: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(reduceMotion ? 0 : -24);
  const o = useSharedValue(0);
  const start = useSharedValue(0);
  const leaving = useSharedValue(false);

  const dismiss = useCallback(() => {
    if (leaving.get()) return;
    leaving.set(true);
    o.set(withTiming(0, { duration: 160 }, (done) => {
      if (done) scheduleOnRN(onGone);
    }));
    if (!reduceMotion) y.set(withTiming(-30, { duration: 160, easing: motion.easeOut }));
  }, [leaving, o, y, onGone, reduceMotion]);

  useEffect(() => {
    o.set(withTiming(1, { duration: motion.duration.toast, easing: motion.easeOut }));
    if (!reduceMotion) y.set(withSpring(0, motion.springSheet));
    const timer = setTimeout(dismiss, 2800);
    return () => clearTimeout(timer);
  }, [o, y, dismiss, reduceMotion]);

  const pan = Gesture.Pan()
    .onBegin(() => start.set(y.get()))
    .onUpdate((e) => {
      const ty = start.get() + e.translationY;
      y.set(ty > 0 ? Math.sqrt(ty) * 3 : ty);
    })
    .onEnd((e) => {
      if (e.velocityY < -300 || y.get() < -28) {
        leaving.set(true);
        y.set(withTiming(-120, { duration: 180, easing: motion.easeOut }));
        o.set(withTiming(0, { duration: 180 }, (done) => {
          if (done) scheduleOnRN(onGone);
        }));
      } else {
        y.set(withSpring(0, { ...motion.springSheet, velocity: e.velocityY }));
      }
    });

  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: y.get() }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ position: "absolute", top: insets.top + 8, left: 20, right: 20, zIndex: 2000, alignItems: "flex-start" }, style]} accessibilityLiveRegion="polite">
        <Sticker id={`toast-${text}`} fill={colors.butter} radius={20} padding={0} offset={4} tiltMax={1}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 16, minHeight: 48 }}>
            <Icon name="check" size={22} />
            <Text variant="bodyStrong" style={{ flexShrink: 1 }}>{text}</Text>
          </View>
        </Sticker>
      </Animated.View>
    </GestureDetector>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<{ id: number; text: string } | null>(null);
  const counter = useRef(0);
  const show = useCallback((text: string) => {
    counter.current += 1;
    setItem({ id: counter.current, text });
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {item ? <ToastItem key={item.id} text={item.text} onGone={() => setItem((c) => (c && c.id === item.id ? null : c))} /> : null}
    </ToastContext.Provider>
  );
}
