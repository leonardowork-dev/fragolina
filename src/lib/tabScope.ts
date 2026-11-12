import { uuid } from "./uuid";

/**
 * Nell'anteprima web con la prova locale ogni scheda del browser è un "telefono" a sé: l'identità sta in
 * sessionStorage (per scheda) e gli archivi persistiti prendono un suffisso diverso per scheda.
 * Con Supabase (o su iPhone) il suffisso è vuoto.
 */
export function tabId(): string {
  try {
    let id = sessionStorage.getItem("fragolina.mock.uid");
    if (!id) {
      id = uuid();
      sessionStorage.setItem("fragolina.mock.uid", id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function storageScope(): string {
  const isWeb = typeof document !== "undefined";
  const hasKeys =
    !!process.env.EXPO_PUBLIC_SUPABASE_URL && !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return isWeb && !hasKeys ? `.${tabId().slice(0, 8)}` : "";
}
