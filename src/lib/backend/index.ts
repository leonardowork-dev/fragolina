import { Platform } from "react-native";

import type { Backend } from "./types";

export type { Backend } from "./types";

let instance: Backend | null = null;

/**
 * Sceglie il backend: Supabase se nell'ambiente ci sono le due chiavi pubbliche, altrimenti la prova locale.
 * Le variabili EXPO_PUBLIC_* vengono sostituite in fase di build, quindi vanno scritte per intero.
 */
export function getBackend(): Backend {
  if (instance) return instance;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- caricamento pigro: solo la piattaforma/backend che serve
    const { SupabaseBackend } =
      require("./supabase/SupabaseBackend") as typeof import("./supabase/SupabaseBackend");
    instance = new SupabaseBackend(url, key);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- caricamento pigro: solo la piattaforma/backend che serve
    const { createDefaultMock } =
      require("./mock/defaultMock") as typeof import("./mock/defaultMock");
    instance = createDefaultMock(Platform.OS === "web");
  }
  return instance;
}

export function setBackendForTests(b: Backend | null) {
  instance = b;
}
