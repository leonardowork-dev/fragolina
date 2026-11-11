import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { useSettings } from "@/state/settingsStore";

/**
 * Aptica: una sola per azione utente, mai come unico feedback, mai per frame.
 * Rispetta l'interruttore "Vibrazioni" nelle impostazioni. Sul web è un no-op.
 * Da un worklet: scheduleOnRN(haptics.tick) e solo in onEnd/soglie.
 */
const enabled = () => Platform.OS !== "web" && useSettings.getState().haptics;

export const haptics = {
  /** Tick di selezione: picker, detent, cambio tab. */
  tick: () => {
    if (enabled()) void Haptics.selectionAsync().catch(() => {});
  },
  /** Impatto leggero: commit di un'azione, snap. */
  light: () => {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  /** Impatto medio: oggetto pesante che atterra. */
  medium: () => {
    if (enabled()) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  /** Successo: azione completata. */
  success: () => {
    if (enabled())
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
