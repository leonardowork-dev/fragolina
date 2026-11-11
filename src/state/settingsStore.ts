import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { safeStorage } from "@/lib/storage";

/**
 * Preferenze del dispositivo e stato di onboarding. Persistito.
 * reduceMotion: null = segui il sistema, true = forzato (impostazione "Meno movimento").
 */
type SettingsState = {
  hydrated: boolean;
  onboardingDone: boolean;
  haptics: boolean;
  reduceMotionOverride: boolean | null;
  darkOverride: boolean;
  setOnboardingDone: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setReduceMotionOverride: (v: boolean | null) => void;
  setDarkOverride: (v: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      haptics: true,
      reduceMotionOverride: null,
      darkOverride: false,
      setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
      setHaptics: (haptics) => set({ haptics }),
      setReduceMotionOverride: (reduceMotionOverride) => set({ reduceMotionOverride }),
      setDarkOverride: (darkOverride) => set({ darkOverride }),
    }),
    {
      name: "fragolina.settings.v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        onboardingDone: s.onboardingDone,
        haptics: s.haptics,
        reduceMotionOverride: s.reduceMotionOverride,
        darkOverride: s.darkOverride,
      }),
      onRehydrateStorage: () => () => {
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);
