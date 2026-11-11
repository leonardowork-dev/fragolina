import React from "react";
import { ScrollView, type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../ThemeProvider";
import { PAGE_MARGIN } from "../tokens";

/**
 * Pagina: fondo carta, margini 20pt, spazio per la barra delle tab fluttuante e per le safe area.
 * `scroll` (di base sì) usa uno ScrollView; la barra delle tab occupa ~96pt in basso.
 * Uso: <Screen><Text variant="display">…</Text></Screen>
 */
export const TAB_BAR_SPACE = 104;

export function Screen({
  children,
  scroll = true,
  tabBar = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  tabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: insets.top + 12,
    paddingHorizontal: PAGE_MARGIN,
    paddingBottom: (tabBar ? TAB_BAR_SPACE : 24) + insets.bottom,
  };
  if (!scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.ground }, padding, contentStyle]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.ground }}
      contentContainerStyle={[padding, { gap: 20 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
    >
      {children}
    </ScrollView>
  );
}
