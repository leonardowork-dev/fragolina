import type { QueuedOp } from "@/lib/sync/types";

import { type QaDay, type QaSnapshot, questionRefForDay } from "./rules";

/**
 * La domanda come la vede il telefono: ultima lettura del server + coda (la mia risposta si vede subito). Funzioni PURE.
 * La risposta dell'altra persona non si calcola mai qui: arriva solo dal server, e solo dopo la mia (il segreto è del server).
 */
export type QaSlice = { qaServer: QaSnapshot | null };
export const emptyQaSlice = (): QaSlice => ({ qaServer: null });

export const isQaOp = (q: QueuedOp): q is Extract<QueuedOp, { kind: "qaAnswer" | "qaTomorrow" }> => q.kind === "qaAnswer" || q.kind === "qaTomorrow";

/** Mette un giorno (risposta del server) dentro lo snapshot, al posto del vecchio. */
export function mergeQaDay(cur: QaSnapshot | null, d: QaDay, today: string): QaSnapshot {
  const base: QaSnapshot = cur ?? { today, tomorrow: today, tomorrowTurn: false, days: [] };
  const days = base.days.filter((x) => x.day !== d.day);
  days.push(d);
  days.sort((a, b) => (a.day < b.day ? 1 : -1));
  return { ...base, days };
}

/** Il giorno di oggi: dal server se c'è, altrimenti la domanda che spetta (mazzo ordinato per coppia). Con le mie risposte in coda. */
export function qaTodayView(server: QaSnapshot | null, queue: readonly QueuedOp[], coupleId: string | null, today: string, now: number): QaDay {
  const fromServer = server?.days.find((d) => d.day === today) ?? null;
  let d: QaDay = fromServer ?? {
    day: today,
    ref: coupleId ? questionRefForDay(coupleId, today) : "q001",
    custom: null,
    setBy: null,
    mine: null,
    theirsAnswered: false,
    theirs: null,
  };
  const queued = queue.find((q): q is Extract<QueuedOp, { kind: "qaAnswer" }> => q.kind === "qaAnswer" && q.day === today);
  if (queued && !d.mine) d = { ...d, mine: { text: queued.text, choice: null, at: queued.at || now } };
  return d;
}

/** Le risposte ancora in coda per un altro giorno (ieri, a mezzanotte passata): si vedono come mie. */
export function applyQueuedAnswers(days: readonly QaDay[], queue: readonly QueuedOp[]): QaDay[] {
  return days.map((d) => {
    const q = queue.find((x): x is Extract<QueuedOp, { kind: "qaAnswer" }> => x.kind === "qaAnswer" && x.day === d.day);
    return q && !d.mine ? { ...d, mine: { text: q.text, choice: null, at: q.at } } : d;
  });
}

export const queuedTomorrow = (queue: readonly QueuedOp[]): string | null => {
  const q = [...queue].reverse().find((x): x is Extract<QueuedOp, { kind: "qaTomorrow" }> => x.kind === "qaTomorrow");
  return q ? q.text : null;
};
