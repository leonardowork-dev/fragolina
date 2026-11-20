import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { NoteDraw } from "@/lib/note/rules";
import { safeStorage } from "@/lib/storage";

/**
 * Bozza di "Disegna e indovina" (KNOWN_ISSUES 38): chi sta disegnando e esce dalla schermata o chiude l'app non perde
 * il disegno. Si tiene UNA sola bozza (la partita in corso), con l'orario di partenza: il tempo continua a correre
 * dall'orologio, quindi al ritorno ci sono solo i secondi che restano (o, se sono finiti, parte ciò che c'è).
 */
export type DrawDraft = { gameId: string; startedAt: number; draft: NoteDraw | null };
export const DRAFT_VERSION = 1;
/** Una bozza più vecchia di così non ha senso riprenderla (la partita è passata da un pezzo). */
export const DRAFT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

type State = {
  hydrated: boolean;
  current: DrawDraft | null;
  begin: (gameId: string, startedAt: number) => void;
  save: (gameId: string, draft: NoteDraw | null) => void;
  clear: (gameId?: string) => void;
};

export function migrateDraft(old: unknown): { current: DrawDraft | null } {
  const c = (old as { current?: Partial<DrawDraft> } | null)?.current;
  if (c && typeof c.gameId === "string" && typeof c.startedAt === "number") {
    return { current: { gameId: c.gameId, startedAt: c.startedAt, draft: c.draft ?? null } };
  }
  return { current: null };
}

export const useDrawDraft = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      current: null,
      begin: (gameId, startedAt) => set({ current: { gameId, startedAt, draft: null } }),
      save: (gameId, draft) => {
        const c = get().current;
        if (c && c.gameId === gameId) set({ current: { ...c, draft } });
      },
      clear: (gameId) => {
        const c = get().current;
        if (c && (!gameId || c.gameId === gameId)) set({ current: null });
      },
    }),
    {
      name: "fragolina.drawdraft.v1",
      version: DRAFT_VERSION,
      migrate: (old) => migrateDraft(old) as Partial<State>,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ current: s.current }),
      onRehydrateStorage: () => () => {
        useDrawDraft.setState({ hydrated: true });
      },
    },
  ),
);
