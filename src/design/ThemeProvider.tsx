import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { useSettings } from "@/state/settingsStore";

import { type ColorTokens, darkColors, lightColors } from "./tokens";

/**
 * Tema: chiaro di default, scuro solo se forzato dal laboratorio (token pronti).
 * `reduceMotion` = sistema OR override "Meno movimento". Usa `useTheme()` ovunque.
 */
type Theme = { colors: ColorTokens; dark: boolean; reduceMotion: boolean };

const ThemeContext = createContext<Theme>({
  colors: lightColors,
  dark: false,
  reduceMotion: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemReduce = useReducedMotion();
  const override = useSettings((s) => s.reduceMotionOverride);
  const darkOverride = useSettings((s) => s.darkOverride);
  useColorScheme(); // il tema segue solo l'override: la luce è il default voluto
  const value = useMemo<Theme>(
    () => ({
      colors: darkOverride ? darkColors : lightColors,
      dark: darkOverride,
      reduceMotion: override ?? systemReduce,
    }),
    [darkOverride, override, systemReduce],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
