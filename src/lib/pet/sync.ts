import type { QueuedOp } from "@/lib/sync/types";

import {
  type FoodId,
  type PetKind,
  type PetState,
  applyAction,
  applyName,
  emptyPet,
} from "./rules";

/**
 * Parte del pet che arriva (o parte) dal server. Funzioni PURE.
 * Lo stato "vero" (`server`) è l'ultimo arrivato con `rev` più alto. Quello che si VEDE è lo stato del server con sopra
 * le operazioni ancora in coda (ottimistiche): così un rifiuto del server o un doppione si sistemano da soli, senza
 * rollback a mano — basta togliere l'operazione dalla coda.
 */
export type PetLogEntry = {
  rev: number;
  key: string;
  userId: string;
  kind: PetKind | "hatch" | "name";
  item: FoodId | null;
  at: number;
};

export type PetSnapshot = {
  /** null = il server non ha ancora il pet per questa coppia (uovo mai toccato) o non ha la migrazione. */
  state: PetState | null;
  log: PetLogEntry[];
  /** Ultima volta (ms) che QUESTA persona ha fatto ciascuna azione: serve alle pause. */
  myLast: Partial<Record<PetKind, number>>;
};

export type PetSlice = {
  petServer: PetState | null;
  petLog: PetLogEntry[];
  petMyLast: Partial<Record<PetKind, number>>;
};

export const emptyPetSlice = (): PetSlice => ({ petServer: null, petLog: [], petMyLast: {} });

export const LOG_LIMIT = 12;

export type PetQueueOp = Extract<QueuedOp, { kind: "pet" | "petName" }>;
export const isPetOp = (q: QueuedOp): q is PetQueueOp => q.kind === "pet" || q.kind === "petName";

/** Fotografia dal server: sostituisce lo stato se non è più vecchio di quello che abbiamo. */
export function mergePetSnapshot(cur: PetSlice, snap: PetSnapshot | null): PetSlice {
  if (!snap) return cur;
  const curRev = cur.petServer?.rev ?? -1;
  const server = snap.state && snap.state.rev >= curRev ? snap.state : cur.petServer;
  return {
    petServer: server,
    petLog: mergeLog(cur.petLog, snap.log),
    petMyLast: { ...cur.petMyLast, ...snap.myLast },
  };
}

/** Evento in tempo reale: la riga nuova del pet. Ritorna anche la voce di registro e se è una novità. */
export function mergePetEvent(
  cur: PetSlice,
  pet: PetState,
): { slice: PetSlice; fresh: boolean; entry: PetLogEntry | null } {
  if (cur.petServer && pet.rev <= cur.petServer.rev) return { slice: cur, fresh: false, entry: null };
  const entry = entryFromState(pet);
  return {
    slice: { ...cur, petServer: pet, petLog: entry ? mergeLog(cur.petLog, [entry]) : cur.petLog },
    fresh: true,
    entry,
  };
}

/** Il registro si ricava dall'ultima azione scritta nella riga (il tempo reale non manda il registro intero). */
export function entryFromState(p: PetState): PetLogEntry | null {
  if (!p.lastKind || !p.lastBy || !p.lastKey) return null;
  return {
    rev: p.rev,
    key: p.lastKey,
    userId: p.lastBy,
    kind: p.lastKind,
    item: p.lastItem,
    at: p.lastKind === "name" ? p.nameAt : p.lastAt,
  };
}

export function mergeLog(a: PetLogEntry[], b: PetLogEntry[]): PetLogEntry[] {
  const byKey = new Map<string, PetLogEntry>();
  for (const e of [...a, ...b]) {
    const old = byKey.get(e.key);
    if (!old || e.rev >= old.rev) byKey.set(e.key, e);
  }
  return [...byKey.values()].sort((x, y) => y.rev - x.rev || y.at - x.at).slice(0, LOG_LIMIT * 2);
}

/** Lo stato da mostrare: server + operazioni in coda non ancora viste dal server. */
export function replayPet(
  slice: PetSlice,
  queue: readonly QueuedOp[],
  me: { userId: string | null; role: "a" | "b" | null },
  pendingTouches = 0,
  pendingAt = 0,
  pendingDay = "",
): PetState {
  let p = slice.petServer ?? emptyPet();
  const seen = new Set(slice.petLog.map((e) => e.key));
  if (p.lastKey) seen.add(p.lastKey);
  if (!me.userId || !me.role) return p;
  for (const q of queue) {
    if (!isPetOp(q) || seen.has(q.key)) continue;
    if (q.kind === "petName") p = applyName(p, q.name, q.at, q.key, me.userId);
    else
      p = applyAction(p, {
        kind: q.action.kind,
        item: q.action.item,
        amount: q.action.amount,
        role: me.role,
        userId: me.userId,
        at: q.at,
        day: q.action.day,
        key: q.key,
      }).pet;
  }
  if (pendingTouches > 0)
    p = applyAction(p, {
      kind: "touch",
      amount: pendingTouches,
      role: me.role,
      userId: me.userId,
      at: pendingAt,
      day: pendingDay,
    }).pet;
  return p;
}

/** Ultima volta che io ho fatto `kind`: il massimo fra quanto sa il server e ciò che è in coda. */
export function myLastAt(slice: PetSlice, queue: readonly QueuedOp[], kind: PetKind): number {
  let at = slice.petMyLast[kind] ?? 0;
  for (const q of queue) if (q.kind === "pet" && q.action.kind === kind) at = Math.max(at, q.at);
  return at;
}

export type PetLogView = {
  id: string;
  userId: string;
  kind: PetLogEntry["kind"];
  item: FoodId | null;
  at: number;
  pending: boolean;
};

/** Le "ultime cure": quelle in coda (mie, in cima) e poi quelle del server. */
export function buildLogView(
  slice: PetSlice,
  queue: readonly QueuedOp[],
  myUserId: string | null,
  limit = 5,
): PetLogView[] {
  const seen = new Set(slice.petLog.map((e) => e.key));
  const pending: PetLogView[] = [];
  for (const q of queue)
    if (q.kind === "pet" && q.action.kind !== "touch" && !seen.has(q.key) && myUserId)
      pending.push({
        id: q.key,
        userId: myUserId,
        kind: q.action.kind,
        item: q.action.item,
        at: q.at,
        pending: true,
      });
  const real: PetLogView[] = slice.petLog
    .filter((e) => e.kind !== "touch" && e.kind !== "name")
    .map((e) => ({ id: e.key, userId: e.userId, kind: e.kind, item: e.item, at: e.at, pending: false }));
  return [...pending.reverse(), ...real].slice(0, limit);
}
