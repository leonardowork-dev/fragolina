import { create } from "zustand";

import { seeded } from "@/lib/hash";

/** Stato (puro) dell'animazione della zona: 5 varianti a rotazione, mai due uguali di fila. */
type HeatState = { seq: number; variant: number; kind: "plus" | "milestone" | "match"; label: string | null; /** Visibile in questo momento? Si spegne da solo e fuori dalla zona. */ active: boolean; clear: () => void; fire: (kind?: "plus" | "milestone" | "match", label?: string | null) => void };
export const useHeat = create<HeatState>((set, get) => ({
  seq: 0,
  variant: 0,
  kind: "plus",
  label: null,
  active: false,
  clear: () => set({ active: false, label: null }),
  fire: (kind = "plus", label = null) => {
    const seq = get().seq + 1;
    // la variante non si ripete due volte di fila
    let v = Math.floor(seeded(seq * 7919 + Date.now() % 1000) * 5);
    if (v === get().variant) v = (v + 1) % 5;
    set({ seq, variant: v, kind, label, active: true });
  },
}));

