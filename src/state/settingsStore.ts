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
  /** Suoni piccoli sulle azioni (acceso di default). "Meno movimento" non li spegne. */
  sounds: boolean;
  reduceMotionOverride: boolean | null;
  darkOverride: boolean;
  /** Aggiornare la posizione anche ad app chiusa (permesso "Sempre", solo iOS). */
  locationAlways: boolean;
  /** "Mostra la zona piccante": se spento il gesto segreto non fa niente. */
  zoneEnabled: boolean;
  setZoneEnabled: (v: boolean) => void;
  setOnboardingDone: (v: boolean) => void;
  setHaptics: (v: boolean) => void;
  setSounds: (v: boolean) => void;
  setReduceMotionOverride: (v: boolean | null) => void;
  setDarkOverride: (v: boolean) => void;
  setLocationAlways: (v: boolean) => void;
};

/** v0 = prima della sessione 8 (senza `sounds`). v1 = con `sounds`. */
export const SETTINGS_VERSION = 2;

export function migrateSettings(old: unknown, version: number): Partial<SettingsState> {
  const s = (old && typeof old === "object" ? old : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  if (version < 1 && typeof out.sounds !== "boolean") out.sounds = true;
  if (typeof out.zoneEnabled !== "boolean") out.zoneEnabled = true;
  return out as Partial<SettingsState>;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboardingDone: false,
      haptics: true,
      sounds: true,
      reduceMotionOverride: null,
      darkOverride: false,
      locationAlways: false,
      zoneEnabled: true,
      setZoneEnabled: (zoneEnabled) => set({ zoneEnabled }),
      setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
      setHaptics: (haptics) => set({ haptics }),
      setSounds: (sounds) => set({ sounds }),
      setReduceMotionOverride: (reduceMotionOverride) => set({ reduceMotionOverride }),
      setDarkOverride: (darkOverride) => set({ darkOverride }),
      setLocationAlways: (locationAlways) => set({ locationAlways }),
    }),
    {
      name: "fragolina.settings.v1",
      version: SETTINGS_VERSION,
      migrate: migrateSettings,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        onboardingDone: s.onboardingDone,
        haptics: s.haptics,
        sounds: s.sounds,
        reduceMotionOverride: s.reduceMotionOverride,
        darkOverride: s.darkOverride,
        locationAlways: s.locationAlways,
        zoneEnabled: s.zoneEnabled,
      }),
      onRehydrateStorage: () => () => {
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);
