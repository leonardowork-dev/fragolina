import type { QueuedOp } from "@/lib/sync/types";

import { type Memory } from "./types";

/**
 * I ricordi come li vede il telefono: server + coda (ottimistico: una foto appena scelta si vede subito, con "in coda").
 * Funzioni PURE. Cancellare un ricordo ancora in coda lo toglie dalla coda (e basta).
 */
export type MemoriesSlice = { memoriesServer: Memory[] };
export const emptyMemoriesSlice = (): MemoriesSlice => ({ memoriesServer: [] });

export type MemoryQueueOp = Extract<QueuedOp, { kind: "memoryAdd" | "memoryPhoto" | "memoryDelete" }>;
export const isMemoryOp = (q: QueuedOp): q is MemoryQueueOp =>
  q.kind === "memoryAdd" || q.kind === "memoryPhoto" || q.kind === "memoryDelete";

export function replayMemories(server: readonly Memory[], queue: readonly QueuedOp[], me: string, now: number): Memory[] {
  let list = [...server];
  for (const q of queue) {
    if (q.kind === "memoryAdd") {
      if (list.some((m) => m.id === q.id)) continue;
      list.push({
        id: q.id, kind: q.memKind, source: q.source, caption: q.caption, day: q.day, path: null, w: null, h: null, bytes: null,
        content: q.content, by: me, createdAt: q.at || now, pending: true,
      });
    } else if (q.kind === "memoryPhoto") {
      if (list.some((m) => m.id === q.id)) continue;
      list.push({
        id: q.id, kind: "photo", source: "photo", caption: q.caption, day: q.day, path: null, w: q.w, h: q.h, bytes: q.bytes,
        content: null, by: me, createdAt: q.at || now, pending: true, localUri: q.uri,
      });
    } else if (q.kind === "memoryDelete") {
      list = list.filter((m) => m.id !== q.id);
    }
  }
  return list.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : b.createdAt - a.createdAt));
}
