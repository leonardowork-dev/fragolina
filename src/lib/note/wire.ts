import type { LocationState, PartnerLoc, PartnerLocState } from "@/lib/geo/types";
import { emptyLocation } from "@/lib/geo/types";

import type { Note, NoteContent, NoteKind, NoteRow } from "./rules";

type J = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ts = (v: unknown): number | null => (typeof v === "string" ? Date.parse(v) : num(v));

/** Biglietto come lo manda il server (`_note_json`: istanti in millisecondi). */
export function noteFromJson(d: unknown): Note | null {
  if (!d || typeof d !== "object") return null;
  const j = d as J;
  if (typeof j.id !== "string" || (j.kind !== "draw" && j.kind !== "text")) return null;
  const createdAt = num(j.createdAt);
  const expiresAt = num(j.expiresAt);
  if (createdAt === null || expiresAt === null) return null;
  return {
    id: j.id,
    kind: j.kind as NoteKind,
    content: j.content as NoteContent,
    by: j.by === "me" ? "me" : "partner",
    byName: typeof j.byName === "string" ? j.byName : "",
    createdAt,
    expiresAt,
    clearedAt: num(j.clearedAt),
  };
}

/** Riga di `notes` nel tempo reale (timestamp ISO). */
export function noteRowFromRecord(r: J): NoteRow | null {
  const createdAt = ts(r.created_at);
  const expiresAt = ts(r.expires_at);
  if (typeof r.id !== "string" || (r.kind !== "draw" && r.kind !== "text") || createdAt === null || expiresAt === null)
    return null;
  let content = r.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      return null;
    }
  }
  return {
    id: r.id,
    kind: r.kind as NoteKind,
    content: content as NoteContent,
    userId: String(r.user_id),
    createdAt,
    expiresAt,
    clearedAt: ts(r.cleared_at),
  };
}

export function locationFromJson(d: unknown): LocationState {
  if (!d || typeof d !== "object") return emptyLocation();
  const j = d as J;
  const me = j.me as J | null;
  const p = j.partner as J | null;
  const states: PartnerLocState[] = ["ok", "hidden", "mine_off", "none"];
  const partner: PartnerLoc | null =
    p && typeof p === "object"
      ? {
          name: typeof p.name === "string" ? p.name : "",
          state: states.includes(p.state as PartnerLocState) ? (p.state as PartnerLocState) : "none",
          latE2: num(p.latE2),
          lonE2: num(p.lonE2),
          at: num(p.at),
        }
      : null;
  return {
    sharing: j.sharing === true,
    me:
      me && num(me.latE2) !== null && num(me.lonE2) !== null
        ? { latE2: num(me.latE2)!, lonE2: num(me.lonE2)!, at: num(me.at) ?? 0 }
        : null,
    partner,
  };
}

export type Board = { now: number; note: Note | null; location: LocationState };

export function boardFromJson(d: J): Board {
  return { now: num(d.now) ?? Date.now(), note: noteFromJson(d.note), location: locationFromJson(d.location) };
}
