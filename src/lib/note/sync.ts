import type { Member, QueuedOp } from "@/lib/sync/types";

import { NOTE_TTL_MS, type Note, type NoteRow } from "./rules";

/**
 * Il biglietto come lo vede il telefono: ultimo biglietto del server + operazioni ancora in coda (ottimistiche).
 * Funzioni PURE (come src/lib/pet/sync.ts): per annullare un invio rifiutato basta toglierlo dalla coda.
 */
export type NoteSlice = { noteServer: Note | null };
export const emptyNoteSlice = (): NoteSlice => ({ noteServer: null });

export type NoteQueueOp = Extract<QueuedOp, { kind: "note" | "noteClear" }>;
export const isNoteOp = (q: QueuedOp): q is NoteQueueOp => q.kind === "note" || q.kind === "noteClear";

export const localNoteId = (key: string) => `local-${key}`;
export const isLocalNoteId = (id: string) => id.startsWith("local-");

/** Fra due versioni: vince il biglietto più recente; a parità, quello pulito. */
export function mergeNote(cur: Note | null, incoming: Note | null): Note | null {
  if (!incoming) return cur;
  if (!cur) return incoming;
  if (incoming.id === cur.id) return incoming.clearedAt !== null || cur.clearedAt === null ? incoming : cur;
  return incoming.createdAt >= cur.createdAt ? incoming : cur;
}

/** Riga del tempo reale → biglietto "relativo" a chi guarda. */
export function noteFromRow(row: NoteRow, me: string | null, members: readonly Member[]): Note {
  return {
    id: row.id,
    kind: row.kind,
    content: row.content,
    by: row.userId === me ? "me" : "partner",
    byName: members.find((m) => m.userId === row.userId)?.displayName ?? "",
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    clearedAt: row.clearedAt,
  };
}

/** Il biglietto da mostrare: server + coda. `null` = niente. */
export function replayNote(server: Note | null, queue: readonly QueuedOp[], meName: string): Note | null {
  let n = server;
  for (const q of queue) {
    if (q.kind === "note")
      n = {
        id: localNoteId(q.key),
        kind: q.noteKind,
        content: q.content,
        by: "me",
        byName: meName,
        createdAt: q.at,
        expiresAt: q.at + NOTE_TTL_MS,
        clearedAt: null,
        pending: true,
      };
    else if (q.kind === "noteClear" && n && (n.id === q.id || (isLocalNoteId(q.id) && isLocalNoteId(n.id))))
      n = { ...n, clearedAt: q.at, pending: true };
  }
  return n;
}
