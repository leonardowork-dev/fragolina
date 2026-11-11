import { create } from "zustand";

/** Umori della mascotte. */
export type MascotMood = "idle" | "happy" | "sleepy" | "surprised" | "love";

type MascotStore = {
  mood: MascotMood | null; // reazione temporanea; null = nessuna
  nonce: number; // cambia a ogni reazione, anche con lo stesso umore
  react: (mood: MascotMood, ms?: number) => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Reazioni della mascotte da qualsiasi punto dell'app (es. dopo "Penso a te").
 * Uso: useMascot.getState().react("love") oppure const react = useMascot(s => s.react).
 * I <Mascot reactive /> si aggiornano da soli e tornano all'umore base dopo `ms`.
 */
export const useMascot = create<MascotStore>((set) => ({
  mood: null,
  nonce: 0,
  react: (mood, ms = 1800) => {
    if (timer) clearTimeout(timer);
    set((s) => ({ mood, nonce: s.nonce + 1 }));
    timer = setTimeout(() => set({ mood: null }), ms);
  },
}));
