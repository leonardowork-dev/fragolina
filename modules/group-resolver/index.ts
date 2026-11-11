import { requireNativeModule } from "expo";

/** Ponte nativo (solo iOS): risolve l'App Group a runtime, scrive il payload per il widget, ricarica le timeline. */
export type GroupResolverNative = {
  resolveGroupId(): string | null;
  candidates(): string[];
  writePayload(json: string): string | null;
  readPayload(): string | null;
  reloadWidgets(): void;
};

let cached: GroupResolverNative | null | undefined;

/** Carica il modulo in modo pigro: sul web o in Expo Go (senza il modulo) restituisce null invece di lanciare. */
export function getGroupResolver(): GroupResolverNative | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireNativeModule<GroupResolverNative>("GroupResolver");
  } catch {
    cached = null;
  }
  return cached;
}
