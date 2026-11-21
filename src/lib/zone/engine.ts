import { addDaysIso } from "@/lib/time";

import type { IdeaLevel, Place, Starter, TonightAnswer, ZOp, ZSnapshot } from "./types";
import { PLACES } from "./types";

/**
 * Il "server" della zona in TypeScript per UNA coppia: stesse regole delle funzioni SQL z_* (migrazione
 * 20261122000001_zona.sql). Serve al finto server delle prove e alla prova da solo. Stato serializzabile.
 */
export type ZoneDb = {
  entries: { id: string; userId: string; day: string; at: number; place: Place | null; starter: Starter | null; rating: number | null; note: string | null; deleted: boolean; updatedAt: number }[];
  ideas: { id: string; userId: string; text: string; level: IdeaLevel }[];
  wishes: { userId: string; idea: string }[];
  tonight: { userId: string; day: string; answer: TonightAnswer }[];
  signals: { userId: string; level: 1 | 2 | 3; at: number; expiresAt: number }[];
  vouchers: { id: string; from: string; to: string; title: string; expires: string | null; redeemedAt: number | null; deleted: boolean; createdAt: number }[];
  pulse: number;
};

export const emptyZoneDb = (): ZoneDb => ({ entries: [], ideas: [], wishes: [], tonight: [], signals: [], vouchers: [], pulse: 0 });

export type ZoneCtx = { uid: string; members: { userId: string; role: "a" | "b" }[]; now: number; today: string };
export type ZoneResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ZoneResult => ({ ok: false, error });
const IDEA_RE = /^(d\d{3}|c-[0-9a-f-]{36})$/;

const otherOf = (c: ZoneCtx) => c.members.find((m) => m.userId !== c.uid)?.userId ?? null;
const ttl = (l: number) => (l === 1 ? 6 : l === 2 ? 4 : 1) * 3_600_000;

export function zoneApply(db: ZoneDb, c: ZoneCtx, op: ZOp): ZoneResult {
  const other = otherOf(c);
  switch (op.kind) {
    case "log": {
      const note = op.note?.trim() ? op.note.trim() : null;
      if (op.day > addDaysIso(c.today, 1) || op.day < addDaysIso(c.today, -3650)) return fail("invalid_content");
      if ((op.place && !PLACES.includes(op.place)) || (op.starter && !["a", "b", "both"].includes(op.starter))) return fail("invalid_content");
      if (op.rating !== null && (op.rating < 1 || op.rating > 5)) return fail("invalid_content");
      if (note && note.length > 140) return fail("invalid_content");
      const cur = db.entries.find((x) => x.id === op.id);
      const row = { id: op.id, userId: cur?.userId ?? c.uid, day: op.day, at: Math.min(op.at, c.now + 86_400_000), place: op.place, starter: op.starter, rating: op.rating, note, deleted: false, updatedAt: c.now };
      if (cur) Object.assign(cur, row);
      else {
        if (db.entries.length >= 5000) return fail("rate_limited");
        db.entries.push(row);
      }
      break;
    }
    case "logDelete": {
      const x = db.entries.find((e) => e.id === op.id);
      if (x) Object.assign(x, { deleted: true, note: null, updatedAt: c.now });
      break;
    }
    case "wish": {
      if (!IDEA_RE.test(op.idea)) return fail("invalid_content");
      if (op.idea.startsWith("c-") && !db.ideas.some((i) => `c-${i.id}` === op.idea)) return fail("invalid_content");
      if (op.on) {
        if (!db.wishes.some((w) => w.userId === c.uid && w.idea === op.idea)) db.wishes.push({ userId: c.uid, idea: op.idea });
      } else db.wishes = db.wishes.filter((w) => !(w.userId === c.uid && w.idea === op.idea));
      if (!db.wishes.some((w) => w.idea === op.idea && w.userId !== c.uid)) return { ok: true }; // niente rumore se non può esserci un match
      break;
    }
    case "ideaAdd": {
      const t = op.text.trim();
      if (t.length < 3 || t.length > 80 || !["dolce", "piccante", "audace"].includes(op.level)) return fail("invalid_content");
      if (db.ideas.some((i) => i.id === op.id)) return { ok: true };
      if (db.ideas.length >= 100) return fail("rate_limited");
      db.ideas.push({ id: op.id, userId: c.uid, text: t, level: op.level });
      db.wishes.push({ userId: c.uid, idea: `c-${op.id}` });
      break;
    }
    case "ideaDelete": {
      if (db.ideas.some((i) => i.id === op.id && i.userId === c.uid)) {
        db.wishes = db.wishes.filter((w) => w.idea !== `c-${op.id}`);
        db.ideas = db.ideas.filter((i) => i.id !== op.id);
      }
      break;
    }
    case "tonight": {
      const mine = db.tonight.find((t) => t.userId === c.uid && t.day === c.today);
      if (mine && other && db.tonight.some((t) => t.userId === other && t.day === c.today)) return fail("already_answered");
      if (mine) mine.answer = op.answer;
      else db.tonight.push({ userId: c.uid, day: c.today, answer: op.answer });
      break;
    }
    case "signal": {
      db.signals = db.signals.filter((s) => s.userId !== c.uid);
      db.signals.push({ userId: c.uid, level: op.level, at: c.now, expiresAt: c.now + ttl(op.level) });
      break;
    }
    case "signalClear":
      db.signals = db.signals.filter((s) => s.userId !== c.uid);
      break;
    case "voucherAdd": {
      const t = op.title.trim();
      if (!other) return fail("no_partner");
      if (t.length < 2 || t.length > 40 || (op.expires && op.expires < addDaysIso(c.today, -1))) return fail("invalid_content");
      if (db.vouchers.some((v) => v.id === op.id)) return { ok: true };
      db.vouchers.push({ id: op.id, from: c.uid, to: other, title: t, expires: op.expires, redeemedAt: null, deleted: false, createdAt: c.now });
      break;
    }
    case "voucherRedeem": {
      const v = db.vouchers.find((x) => x.id === op.id && x.to === c.uid && !x.deleted);
      if (!v) return fail("not_found");
      if (v.redeemedAt !== null) return { ok: true };
      if (v.expires && v.expires < c.today) return fail("expired");
      v.redeemedAt = c.now;
      break;
    }
    case "voucherDelete": {
      const v = db.vouchers.find((x) => x.id === op.id && x.from === c.uid);
      if (v) v.deleted = true;
      break;
    }
    case "wipe":
      Object.assign(db, emptyZoneDb(), { pulse: db.pulse });
      break;
  }
  db.pulse++;
  return { ok: true };
}

/** Quello che z_get restituisce a `c.uid`: i desideri dell'altro non escono mai, solo i match. */
export function zoneSnapshot(db: ZoneDb, c: ZoneCtx): ZSnapshot {
  const other = otherOf(c);
  const roleOf = (u: string) => c.members.find((m) => m.userId === u)?.role ?? null;
  const mine = db.tonight.find((t) => t.userId === c.uid && t.day === c.today)?.answer ?? null;
  const theirs = other ? (db.tonight.find((t) => t.userId === other && t.day === c.today)?.answer ?? null) : null;
  const result = mine && theirs ? ((mine === "yes" && theirs !== "no") || (mine === "maybe" && theirs === "yes") ? "match" : "nomatch") : null;
  const count = new Map<string, Set<string>>();
  for (const w of db.wishes) count.set(w.idea, (count.get(w.idea) ?? new Set()).add(w.userId));
  const sig = (u: string | null) => {
    const s = u ? db.signals.find((x) => x.userId === u && x.expiresAt > c.now) : undefined;
    return s ? { level: s.level, at: s.at, expiresAt: s.expiresAt } : null;
  };
  return {
    now: c.now,
    today: c.today,
    pulse: db.pulse,
    entries: db.entries
      .filter((e) => !e.deleted)
      .sort((a, b) => (a.day === b.day ? a.at - b.at : a.day < b.day ? -1 : 1))
      .map((e) => ({ id: e.id, day: e.day, at: e.at, place: e.place, starter: e.starter, rating: e.rating, note: e.note, by: roleOf(e.userId), updatedAt: e.updatedAt })),
    customIdeas: db.ideas.map((i) => ({ id: `c-${i.id}`, text: i.text, level: i.level, mine: i.userId === c.uid })),
    wishesMine: db.wishes.filter((w) => w.userId === c.uid).map((w) => w.idea).sort(),
    matches: [...count].filter(([, s]) => s.size === 2).map(([i]) => i).sort(),
    tonight: { day: c.today, mine, otherAnswered: theirs !== null, result },
    signal: { incoming: sig(other), mine: sig(c.uid) },
    vouchers: db.vouchers.filter((v) => !v.deleted).map((v) => ({ id: v.id, title: v.title, expires: v.expires, redeemedAt: v.redeemedAt, createdAt: v.createdAt, fromMe: v.from === c.uid })),
  };
}
