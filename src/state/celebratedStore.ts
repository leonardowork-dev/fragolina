import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { safeStorage } from "@/lib/storage";

/**
 * Momenti rari già festeggiati su questo telefono (es. "evento X, giorno Y"): così coriandoli e suono partono UNA volta
 * per evento anche se l'app viene riavviata più volte lo stesso giorno. Persistito, al massimo 60 chiavi (le più recenti).
 */
export const CELEBRATED_MAX = 60;
export const CELEBRATED_VERSION = 1;

type State = {
  hydrated: boolean;
  keys: string[];
  /** true se `key` non era ancora stata festeggiata (e la segna). Prima dell'idratazione dice sempre false. */
  firstTime: (key: string) => boolean;
};

export function migrateCelebrated(old: unknown): { keys: string[] } {
  const k = (old as { keys?: unknown } | null)?.keys;
  return {
    keys: Array.isArray(k)
      ? k.filter((x): x is string => typeof x === "string").slice(-CELEBRATED_MAX)
      : [],
  };
}

export const useCelebrated = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      keys: [],
      firstTime: (key) => {
        const s = get();
        if (!s.hydrated || !key || s.keys.includes(key)) return false;
        set({ keys: [...s.keys, key].slice(-CELEBRATED_MAX) });
        return true;
      },
    }),
    {
      name: "fragolina.celebrated.v1",
      version: CELEBRATED_VERSION,
      migrate: (old) => migrateCelebrated(old) as Partial<State>,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ keys: s.keys }),
      onRehydrateStorage: () => () => {
        useCelebrated.setState({ hydrated: true });
      },
    },
  ),
);
