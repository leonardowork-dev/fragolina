import { create } from "zustand";

/**
 * Richieste dell'interfaccia che arrivano da fuori (link dei widget). Non persistito.
 * `moodSheetRequested`: la Home apre la scelta dell'umore e poi azzera la richiesta.
 */
type IntentState = {
  moodSheetRequested: boolean;
  requestMoodSheet: () => void;
  clearMoodSheet: () => void;
};

export const useIntents = create<IntentState>((set) => ({
  moodSheetRequested: false,
  requestMoodSheet: () => set({ moodSheetRequested: true }),
  clearMoodSheet: () => set({ moodSheetRequested: false }),
}));
