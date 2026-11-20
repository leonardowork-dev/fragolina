import { create } from "zustand";

/**
 * Stato della rete visto dal telefono (non persistito). Serve a due cose:
 * - capire quando la rete TORNA (expo-network) per svuotare subito la coda offline, senza aspettare il backoff;
 * - distinguere "non ho rete" da "il server non risponde" (progetto gratuito di Supabase in pausa dopo 7 giorni).
 */
export const SERVER_DOWN_AFTER = 3;

type NetState = {
  /** null = non lo so ancora. */
  reachable: boolean | null;
  /** Tentativi di collegamento falliti di fila. */
  failStreak: number;
  /** Il telefono ha rete ma il server non risponde da più tentativi: probabilmente in pausa. */
  serverDown: boolean;
  setReachable: (v: boolean | null) => void;
  noteFailure: () => void;
  noteSuccess: () => void;
};

export const useNet = create<NetState>()((set, get) => ({
  reachable: null,
  failStreak: 0,
  serverDown: false,
  setReachable: (reachable) => set({ reachable, ...(reachable === false ? { serverDown: false } : null) }),
  noteFailure: () => {
    const n = get().failStreak + 1;
    set({ failStreak: n, serverDown: n >= SERVER_DOWN_AFTER && get().reachable !== false });
  },
  noteSuccess: () => set({ failStreak: 0, serverDown: false }),
}));

/** Vero se lo stato di expo-network dice che internet c'è. `isInternetReachable` null/undefined = non so → si fida di isConnected. */
export function isOnline(s: { isConnected?: boolean | null; isInternetReachable?: boolean | null }): boolean {
  if (s.isConnected === false) return false;
  if (s.isInternetReachable === false) return false;
  return s.isConnected === true || s.isInternetReachable === true;
}

/** La rete è appena tornata: era giù (false) e ora c'è. Il primo stato (null) non conta. */
export const networkCameBack = (prev: boolean | null, next: boolean): boolean => prev === false && next === true;
