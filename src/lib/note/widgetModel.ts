import { LOC_STALE_MS, distanceView, haversineKm } from "@/lib/geo/distance";
import type { PartnerLoc } from "@/lib/geo/types";
import { S } from "@/lib/strings.it";
import { timeAgo } from "@/lib/time";
import type { WidgetSnapshot } from "@/lib/widgetPayload";

import type { Note } from "./rules";
import { noteFromJson } from "./wire";

/**
 * Cosa mostrano i widget "Biglietto" e "Distanza", calcolato SOLO dallo snapshot, dall'ultimo feed ricevuto dal server
 * (Percorso B) e dall'orario della voce della timeline. Specchio di `FragolinaEntry.noteDisplay` / `.distance…` in
 * targets/widget/Model.swift: tests/swiftParity.test.ts li confronta su molti casi. Usato anche da /widget-preview.
 */
export type WidgetFeed = { note: Note | null; partner: PartnerLoc | null; fetchedAt: number };

/** Il JSON della RPC `widget_feed` → feed. `null` se non è una risposta valida. */
export function feedFromJson(raw: unknown, fetchedAt: number): WidgetFeed | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  if (j.ok !== true) return null;
  const p = j.partner as Record<string, unknown> | null | undefined;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    note: noteFromJson(j.note),
    partner: p
      ? {
          name: typeof p.name === "string" ? p.name : "",
          state: (["ok", "hidden", "mine_off", "none"].includes(String(p.state)) ? p.state : "none") as PartnerLoc["state"],
          latE2: num(p.latE2),
          lonE2: num(p.lonE2),
          at: num(p.at),
        }
      : null,
    fetchedAt,
  };
}

export type NoteWidgetModel = {
  state: "empty" | "note";
  note: Note | null;
  /** "da Nikole · 12 min fa" / "da te · 3 min fa" */
  byLine: string | null;
  /** Minuti che restano. */
  minutesLeft: number;
};

export function noteWidgetModel(s: WidgetSnapshot, feed: WidgetFeed | null, nowMs: number, revoked = false): NoteWidgetModel {
  let n: Note | null = null;
  if (revoked) return { state: "empty", note: null, byLine: null, minutesLeft: 0 };
  if (feed) n = feed.note; // il server ha l'ultima parola (anche su "pulito")
  else if (s.noteId && s.noteContent && s.noteAt !== null && s.noteExpiresAt !== null)
    n = {
      id: s.noteId,
      kind: s.noteKind === "text" ? "text" : "draw",
      content: s.noteContent,
      by: s.noteBy === "me" ? "me" : "partner",
      byName: s.noteByName,
      createdAt: s.noteAt,
      expiresAt: s.noteExpiresAt,
      clearedAt: null,
    };
  if (!n || n.clearedAt !== null || nowMs >= n.expiresAt) return { state: "empty", note: null, byLine: null, minutesLeft: 0 };
  const ago = timeAgo(n.createdAt, nowMs);
  return {
    state: "note",
    note: n,
    byLine: n.by === "me" ? S.note.byMe(ago) : S.note.by(n.byName || s.partnerName || "Lei", ago),
    minutesLeft: Math.max(0, Math.ceil((n.expiresAt - nowMs) / 60000)),
  };
}

export type DistanceWidgetModel = {
  state: "unpaired" | "hidden" | "mine_off" | "none" | "ok";
  km: number | null;
  near: boolean;
  big: string;
  unit: string;
  sentence: string;
  /** "aggiornata 3 h fa" */
  ageText: string | null;
  stale: boolean;
};

export function distanceWidgetModel(s: WidgetSnapshot, feed: WidgetFeed | null, nowMs: number, revoked = false): DistanceWidgetModel {
  const none = (state: DistanceWidgetModel["state"]): DistanceWidgetModel => ({
    state,
    km: null,
    near: false,
    big: "–",
    unit: "km",
    sentence: "",
    ageText: null,
    stale: false,
  });
  const partner: PartnerLoc | null =
    feed?.partner ??
    (s.partnerLocState
      ? {
          name: s.partnerName,
          state: (s.partnerLocState as PartnerLoc["state"]) ?? "none",
          latE2: s.partnerLatE2,
          lonE2: s.partnerLonE2,
          at: s.partnerLocAt,
        }
      : null);
  if (revoked || (!s.paired && !partner)) return none("unpaired");
  if (!s.shareMine) return none("mine_off");
  if (!partner) return none("none");
  if (partner.state === "hidden") return none("hidden");
  if (partner.state === "mine_off") return none("mine_off");
  if (partner.state !== "ok" || partner.latE2 === null || partner.lonE2 === null || s.myLatE2 === null || s.myLonE2 === null)
    return none("none");
  const km = haversineKm({ latE2: s.myLatE2, lonE2: s.myLonE2 }, { latE2: partner.latE2, lonE2: partner.lonE2 });
  const v = distanceView(km);
  const at = partner.at ?? 0;
  return {
    state: "ok",
    km: v.km,
    near: v.near,
    big: v.big,
    unit: v.unit,
    sentence: v.sentence,
    ageText: at > 0 ? S.distance.updated(timeAgo(at, nowMs)) : null,
    stale: at > 0 && nowMs - at > LOC_STALE_MS,
  };
}

/** Voci della timeline del biglietto (specchio di `noteTimelineDates`): adesso, ogni 10 min fino alla scadenza, un attimo dopo. */
export function noteTimelineMs(now: number, expiresAt: number | null): number[] {
  const out = [now];
  if (expiresAt !== null && expiresAt > 0 && expiresAt > now) {
    let t = now + 600_000;
    while (t < expiresAt && out.length < 8) {
      out.push(t);
      t += 600_000;
    }
    out.push(expiresAt + 1000);
  }
  return out;
}

/** Voci della timeline della distanza (specchio di `distanceTimelineDates`): adesso, ogni ora per 6 h, la soglia "vecchia". */
export function distanceTimelineMs(now: number, partnerAt: number | null): number[] {
  const out = [now];
  for (let i = 1; i <= 6; i++) out.push(now + i * 3_600_000);
  if (partnerAt !== null && partnerAt > 0) {
    const d = partnerAt + LOC_STALE_MS + 1000;
    if (d > now && d <= now + 24 * 3_600_000) out.push(d);
  }
  return out.sort((a, b) => a - b);
}
