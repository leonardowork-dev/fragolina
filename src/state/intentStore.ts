import { create } from "zustand";

import type { GameKind } from "@/lib/games/types";

/**
 * Richieste dell'interfaccia che arrivano da fuori (link dei widget). Non persistito.
 * `moodSheetRequested`: la Home apre la scelta dell'umore e poi azzera la richiesta.
 */
type IntentState = {
  moodSheetRequested: boolean;
  requestMoodSheet: () => void;
  clearMoodSheet: () => void;
  /** Un link `fragolina://play/<gioco>`: la scheda Gioca apre quel gioco e azzera la richiesta. `null` = solo la scheda. */
  gameRequest: { kind: GameKind | null; seq: number } | null;
  requestGame: (kind: GameKind | null) => void;
  clearGame: () => void;
};

export const useIntents = create<IntentState>((set) => ({
  moodSheetRequested: false,
  requestMoodSheet: () => set({ moodSheetRequested: true }),
  clearMoodSheet: () => set({ moodSheetRequested: false }),
  gameRequest: null,
  requestGame: (kind) => set((s) => ({ gameRequest: { kind, seq: (s.gameRequest?.seq ?? 0) + 1 } })),
  clearGame: () => set({ gameRequest: null }),
}));
