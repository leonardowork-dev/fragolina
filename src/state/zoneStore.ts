import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getBackend } from "@/lib/backend";
import { safeStorage } from "@/lib/storage";
import { uuid } from "@/lib/uuid";
import { DECK } from "@/lib/zone/deck";
import { type ZoneCtx, type ZoneDb, emptyZoneDb, zoneApply, zoneSnapshot } from "@/lib/zone/engine";
import { RELOCK_MS } from "@/lib/zone/gate";
import { romeDayKey } from "@/lib/time";
import { hashString, seeded } from "@/lib/hash";
import { replayZone } from "@/lib/zone/replay";
import { type ZOp, type ZSnapshot, emptyZSnapshot } from "@/lib/zone/types";

/**
 * Zona privata. PRIVACY: la fotografia dei dati sta SOLO in memoria (mai su disco) e sparisce quando la zona si
 * richiude; su disco resta soltanto la coda delle operazioni non ancora spedite (poche righe), che si svuota appena
 * il server risponde. Niente di tutto questo passa da widget, feed, log o toast fuori dalla zona.
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type ZOpInput = DistributiveOmit<ZOp, "key">;

type ZoneState = {
  /** Aperta (dopo Face ID/PIN) in questo momento? Mai persistito. */
  unlocked: boolean;
  /** Ultimo istante in cui la zona era in primo piano (per richiudere dopo 1 minuto). */
  lastActiveAt: number | null;
  /** `null` = non ancora saputo; `false` = il server non ha la migrazione. */
  available: boolean | null;
  snapshot: ZSnapshot;
  loaded: boolean;
  queue: ZOp[];
  busy: boolean;
  /** Errore leggibile dell'ultima operazione rifiutata (per la zona, mai fuori). */
  rejected: string | null;
  hydrated: boolean;
  /** Prova da solo (non siete ancora in due): partner finto, tutto locale. */
  practice: boolean;
  setPractice: (on: boolean) => void;
  unlock: () => void;
  lock: () => void;
  touch: (now?: number) => void;
  refresh: () => Promise<void>;
  enqueue: (op: ZOpInput) => void;
  flush: () => Promise<void>;
  clearRejected: () => void;
  /** Cancella tutto: svuota il server per entrambi (la coda locale si azzera). */
  wipeAll: () => Promise<boolean>;
  reset: () => void;
};

/** Errori che non si riprovano (il server ha detto no): l'operazione esce dalla coda. */
const FINAL = new Set(["invalid_content", "not_found", "expired", "already_answered", "no_partner", "not_paired", "rate_limited"]);

let flushing: Promise<void> | null = null;

// ---- Prova da solo: un'altra persona FINTA, solo su questo telefono (mai sul server) ----
let pdb: ZoneDb = emptyZoneDb();
let botReady = false;
const pctx = (uid: "me" | "bot"): ZoneCtx => {
  const now = Date.now();
  return { uid, members: [{ userId: "me", role: "a" }, { userId: "bot", role: "b" }], now, today: romeDayKey(now) };
};
function botStart() {
  if (botReady) return;
  botReady = true;
  // la persona finta sceglie una trentina di idee a caso (stesso seme: sempre le stesse) e ti regala un buono
  DECK.forEach((d) => {
    if (seeded(hashString(`bot-${d.id}`)) < 0.35) zoneApply(pdb, pctx("bot"), { kind: "wish", key: "b", idea: d.id, on: true });
  });
  zoneApply(pdb, pctx("bot"), { kind: "voucherAdd", key: "b", id: "00000000-0000-4000-8000-000000000001", title: "Un bacio a richiesta", expires: null });
  // (il buono parte da "bot" verso "me": il motore usa l'altro membro come destinatario)
}
const practiceBackend = {
  zoneGet: async () => {
    botStart();
    return zoneSnapshot(pdb, pctx("me"));
  },
  zoneApply: async (op: ZOp) => {
    const r = zoneApply(pdb, pctx("me"), op);
    if (!r.ok) throw new Error(r.error);
    // la persona finta risponde a "stasera?" (sì) e, se mandi "ho voglia", non fa niente
    if (op.kind === "tonight") zoneApply(pdb, pctx("bot"), { kind: "tonight", key: "b", answer: "yes" });
  },
};
const backendFor = (practice: boolean) => (practice ? practiceBackend : getBackend());

export const useZone = create<ZoneState>()(
  persist(
    (set, get) => ({
      unlocked: false,
      lastActiveAt: null,
      available: null,
      snapshot: emptyZSnapshot(),
      loaded: false,
      queue: [],
      busy: false,
      rejected: null,
      hydrated: false,
      practice: false,
      setPractice: (on) => {
        if (get().practice === on) return;
        pdb = emptyZoneDb();
        botReady = false;
        set({ practice: on, snapshot: emptyZSnapshot(), loaded: false, queue: on ? [] : get().queue });
      },
      unlock: () => set({ unlocked: true, lastActiveAt: Date.now() }),
      lock: () => {
        if (get().practice) {
          pdb = emptyZoneDb();
          botReady = false;
        }
        set({ unlocked: false, snapshot: emptyZSnapshot(), loaded: false, lastActiveAt: null });
      },
      touch: (now = Date.now()) => set({ lastActiveAt: now }),
      refresh: async () => {
        try {
          const snap = await backendFor(get().practice).zoneGet();
          if (snap === null) set({ available: false, loaded: true });
          else set({ available: true, snapshot: snap, loaded: true });
        } catch {
          /* senza rete: resta quello che c'era */
        }
      },
      enqueue: (op) => {
        set((s) => ({ queue: [...s.queue, { ...op, key: uuid() } as ZOp] }));
        void get().flush();
      },
      flush: () => {
        if (flushing) return flushing;
        flushing = (async () => {
          try {
            set({ busy: true });
            const backend = backendFor(get().practice);
            for (let guard = 0; guard < 200; guard++) {
              const op = get().queue[0];
              if (!op) break;
              try {
                await backend.zoneApply(op);
                set((s) => ({ queue: s.queue.filter((q) => q.key !== op.key) }));
              } catch (e) {
                const code = (e as { code?: string; message?: string })?.message ?? "";
                const final = [...FINAL].some((c) => code.includes(c));
                if (!final) break; // rete: si riprova
                set((s) => ({ queue: s.queue.filter((q) => q.key !== op.key), rejected: code }));
              }
            }
            if (get().unlocked) await get().refresh();
          } finally {
            set({ busy: false });
            flushing = null;
          }
        })();
        return flushing;
      },
      clearRejected: () => set({ rejected: null }),
      wipeAll: async () => {
        try {
          set({ queue: [] });
          await backendFor(get().practice).zoneApply({ kind: "wipe", key: uuid() });
          set({ snapshot: emptyZSnapshot() });
          await get().refresh();
          return true;
        } catch {
          return false;
        }
      },
      reset: () => set({ unlocked: false, snapshot: emptyZSnapshot(), loaded: false, queue: [], available: null, rejected: null, lastActiveAt: null }),
    }),
    {
      name: "fragolina.zone.queue.v1",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ queue: s.queue }),
      migrate: (old) => ({ queue: Array.isArray((old as { queue?: unknown })?.queue) ? (old as { queue: ZOp[] }).queue : [] }),
      onRehydrateStorage: () => () => useZone.setState({ hydrated: true }),
    },
  ),
);

/** La vista che si mostra: server + coda. `me.role` = ruolo di questo telefono. */
export const selectZoneView = (s: ZoneState, role: "a" | "b" | null, now: number): ZSnapshot => replayZone(s.snapshot, s.queue, { role }, now);

export { RELOCK_MS };
