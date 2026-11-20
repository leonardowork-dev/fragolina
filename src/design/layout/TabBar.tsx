import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";

import { useTheme } from "../ThemeProvider";
import { Icon, type IconName } from "../icons/Icon";
import { Text } from "../primitives/Text";
import { outline } from "../tokens";

/**
 * Barra delle tab: adesivo di carta con contorno e ombra dura, fluttuante. La macchia fragola dell'attiva
 * cambia posto subito (elemento assoluto e senza figli). Cancello di frequenza: le tab non si animano, né il
 * contenuto (animation: none), né la macchia, né il glifo. Tick aptico alla selezione.
 */
const ICONS: Record<string, IconName> = {
  index: "home",
  pet: "pet",
  draw: "draw",
  play: "play",
  us: "us",
};
const LABELS: Record<string, string> = {
  index: S.tabs.home,
  pet: S.tabs.pet,
  draw: S.tabs.draw,
  play: S.tabs.play,
  us: S.tabs.us,
};
const BAR_PAD = 6;

function TabItem({
  routeName,
  focused,
  onPress,
  label,
}: {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 1 }}
    >
      <Icon
        name={ICONS[routeName] ?? "home"}
        size={26}
        fill={focused ? colors.butter : colors.blushSoft}
      />
      <Text
        variant="caption"
        maxFontSizeMultiplier={1.15}
        style={{ fontSize: 11, lineHeight: 13, fontFamily: "Figtree_700Bold" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const itemW = w > 0 ? (w - BAR_PAD * 2) / state.routes.length : 0;
  const x = useSharedValue(0);
  const hasPlaced = useSharedValue(false);

  useEffect(() => {
    if (itemW === 0) return;
    // Cancello di frequenza: le tab non si animano (durata 0). La macchia cambia posto nello stesso frame del tocco.
    x.set(state.index * itemW);
    hasPlaced.set(true);
  }, [state.index, itemW, x, hasPlaced]);

  const blob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 20, right: 20, bottom: Math.max(insets.bottom, 10) + 4 }}
    >
      <View
        accessibilityRole="tablist"
        accessibilityLabel={S.a11y.tabBar}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            right: -4,
            bottom: -4,
            borderRadius: 30,
            backgroundColor: colors.shadow,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            padding: BAR_PAD,
            borderRadius: 30,
            backgroundColor: colors.surface,
            borderWidth: outline.width,
            borderColor: colors.outline,
          }}
        >
          {itemW > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: BAR_PAD,
                  left: BAR_PAD,
                  width: itemW,
                  height: 56,
                  borderRadius: 24,
                  backgroundColor: colors.accent,
                  borderWidth: outline.width,
                  borderColor: colors.outline,
                },
                blob,
              ]}
            />
          ) : null}
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const onPress = () => {
              if (focused) return;
              haptics.tick();
              navigateToTab(route.key);
            };
            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                label={LABELS[route.name] ?? route.name}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
