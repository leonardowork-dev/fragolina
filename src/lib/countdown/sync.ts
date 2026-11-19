import type { QueuedOp } from "@/lib/sync/types";

import { type CountdownEvent, MAX_EVENTS, cleanTitle } from "./rules";

/**
 * Gli eventi come li vede il telefono: server + coda (ottimistico). Funzioni PURE: per annullare una modifica rifiutata
 * basta toglierla dalla coda. Last-write-wins per `at`, come sul server; un solo evento "in evidenza".
 */
export type EventsSlice = { eventsServer: CountdownEvent[] };
export const emptyEventsSlice = (): EventsSlice => ({ eventsServer: [] });

export type EventQueueOp = Extract<QueuedOp, { kind: "eventUpsert" | "eventDelete" }>;
export const isEventOp = (q: QueuedOp): q is EventQueueOp => q.kind === "eventUpsert" || q.kind === "eventDelete";

function applyFeatured(list: CountdownEvent[], keepId: string | null): CountdownEvent[] {
  if (!keepId) return list;
  return list.map((e) => (e.id !== keepId && e.featured ? { ...e, featured: false } : e));
}

export function replayEvents(server: readonly CountdownEvent[], queue: readonly QueuedOp[]): CountdownEvent[] {
  let list = [...server];
  for (const q of queue) {
    if (q.kind === "eventUpsert") {
      const cur = list.find((e) => e.id === q.event.id);
      if (cur && cur.at > q.event.at) continue;
      const ev = { ...q.event, title: cleanTitle(q.event.title) };
      list = cur ? list.map((e) => (e.id === ev.id ? ev : e)) : list.length < MAX_EVENTS ? [...list, ev] : list;
      if (ev.featured) list = applyFeatured(list, ev.id);
    } else if (q.kind === "eventDelete") {
      list = list.filter((e) => e.id !== q.id);
    }
  }
  return list;
}

/** Il server manda l'elenco intero: si adotta com'è (la coda poi si riapplica sopra). */
export function mergeEvents(_cur: readonly CountdownEvent[], incoming: readonly CountdownEvent[]): CountdownEvent[] {
  return [...incoming];
}

export function eventsFromJson(d: unknown): CountdownEvent[] {
  if (!Array.isArray(d)) return [];
  const out: CountdownEvent[] = [];
  for (const x of d) {
    if (!x || typeof x !== "object") continue;
    const j = x as Record<string, unknown>;
    if (typeof j.id !== "string" || typeof j.title !== "string" || typeof j.date !== "string" || typeof j.icon !== "string") continue;
    out.push({
      id: j.id,
      title: j.title,
      date: j.date,
      time: typeof j.time === "string" ? j.time : null,
      icon: j.icon as CountdownEvent["icon"],
      featured: j.featured === true,
      at: typeof j.at === "number" ? j.at : 0,
      ...(typeof j.by === "string" ? { by: j.by } : null),
    });
  }
  return out;
}
