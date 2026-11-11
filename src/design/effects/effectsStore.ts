import { create } from "zustand";

/**
 * Bus degli effetti: chiunque può far partire cuori o coriandoli senza conoscere i layer
 * (che stanno nella radice dell'app). Le coordinate sono in pixel di pagina.
 */
type EffectsStore = {
  heartSeq: number;
  heartX: number;
  heartY: number;
  confettiSeq: number;
  confettiX: number;
  confettiY: number;
  fireHearts: (x: number, y: number) => void;
  fireConfetti: (x?: number, y?: number) => void;
};

export const useEffectsBus = create<EffectsStore>((set) => ({
  heartSeq: 0,
  heartX: 0,
  heartY: 0,
  confettiSeq: 0,
  confettiX: -1,
  confettiY: -1,
  fireHearts: (x, y) => set((s) => ({ heartSeq: s.heartSeq + 1, heartX: x, heartY: y })),
  fireConfetti: (x = -1, y = -1) =>
    set((s) => ({ confettiSeq: s.confettiSeq + 1, confettiX: x, confettiY: y })),
}));
