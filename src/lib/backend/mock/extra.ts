import { type CountdownEvent, type EventInput, cleanTitle, validateEvent } from "@/lib/countdown/rules";
import type { MonthRaw } from "@/lib/memories/month";
import { type Memory, type MemoryKind, type MemorySource, cleanCaption } from "@/lib/memories/types";
import { validateContent } from "@/lib/note/rules";
import { ANSWER_MAX, type QaDay, type QaSnapshot, TOMORROW_MAX, TOMORROW_MIN, cleanQuestion, tomorrowAuthorRole } from "@/lib/qa/rules";
import { addDaysIso, romeDayKey } from "@/lib/time";
import type { RemoteEvent } from "@/lib/sync/types";

import type { MockState, Res, ServerChange } from "./server";

/**
 * Specchio delle funzioni SQL della sessione 7 (conto alla rovescia, domanda vera, ricordi, mese): stesse regole,
 * stessi codici d'errore, stesso segreto (la risposta dell'altro esce solo se hai risposto anche tu).
 */
export type MockEventRow = CountdownEvent & { coupleId: string; deleted: boolean };
export type MockQaDayRow = { coupleId: string; day: string; ref: string; custom: string | null; setBy: string | null };
export type MockQaAnswerRow = { coupleId: string; userId: string; day: string; text: string; at: number };
export type MockMemoryRow = Memory & { coupleId: string; deleted: boolean };
export type ExtraState = {
  events: MockEventRow[];
  qaDays: MockQaDayRow[];
  qaAnswers: MockQaAnswerRow[];
  memories: MockMemoryRow[];
  /** "Storage": percorso → indirizzo `data:` della foto. */
  files: Record<string, string>;
};
export const emptyExtra = (): ExtraState => ({ events: [], qaDays: [], qaAnswers: [], memories: [], files: {} });

const REF_RE = /^(q\d{3,5}|l-[a-z0-9-]{1,40})$/;

export class MockExtra {
  constructor(
    private readonly read: () => MockState,
    private readonly write: (s: MockState) => void,
    private readonly emit: (c: ServerChange) => void,
    private readonly clock: () => number,
    private readonly coupleOf: (s: MockState, uid: string) => string | null,
  ) {}

  private ex(s: MockState): ExtraState {
    return (s.extra ??= emptyExtra());
  }
  private ping(cid: string, uid: string, what: Extract<RemoteEvent, { type: "extra" }>["what"]) {
    this.emit({ coupleId: cid, actor: uid, event: { type: "extra", what } });
  }
  private today() {
    return romeDayKey(this.clock());
  }

  // ---------- conto alla rovescia ----------
  private eventsOf(s: MockState, cid: string): CountdownEvent[] {
    return this.ex(s)
      .events.filter((e) => e.coupleId === cid && !e.deleted)
      .map(({ coupleId: _c, deleted: _d, ...e }) => e)
      .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time ?? "") < (b.time ?? "") ? -1 : 1));
  }
  getEvents(uid: string): Res<{ events: CountdownEvent[] }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    return { ok: true, events: this.eventsOf(s, cid) };
  }
  upsertEvent(uid: string, a: { id: string; input: EventInput; at: number }): Res<{ events: CountdownEvent[] }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if (!a.id || validateEvent(a.input) || a.at < 0) return { ok: false, error: "invalid_action" };
    const ex = this.ex(s);
    const cur = ex.events.find((e) => e.id === a.id);
    if (cur && cur.coupleId !== cid) return { ok: false, error: "invalid_action" };
    const row: MockEventRow = {
      id: a.id,
      coupleId: cid,
      title: cleanTitle(a.input.title),
      date: a.input.date,
      time: a.input.time,
      icon: a.input.icon,
      featured: a.input.featured,
      at: a.at,
      by: uid,
      deleted: false,
    };
    if (cur) {
      if (cur.at <= a.at) Object.assign(cur, row);
    } else {
      if (ex.events.filter((e) => e.coupleId === cid && !e.deleted).length >= 60) return { ok: false, error: "invalid_action" };
      ex.events.push(row);
    }
    const now = ex.events.find((e) => e.id === a.id);
    if (a.input.featured && now && now.featured && !now.deleted)
      for (const e of ex.events) if (e.coupleId === cid && e.id !== a.id) e.featured = false;
    this.write(s);
    this.ping(cid, uid, "events");
    return { ok: true, events: this.eventsOf(s, cid) };
  }
  deleteEvent(uid: string, a: { id: string; at: number }): Res<{ events: CountdownEvent[] }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const cur = this.ex(s).events.find((e) => e.id === a.id && e.coupleId === cid);
    if (cur && cur.at <= a.at) {
      cur.deleted = true;
      cur.featured = false;
      cur.at = a.at;
      this.write(s);
      this.ping(cid, uid, "events");
    }
    return { ok: true, events: this.eventsOf(s, cid) };
  }

  // ---------- domanda del giorno vera ----------
  private dayJson(s: MockState, cid: string, uid: string, day: string): QaDay | null {
    const ex = this.ex(s);
    const d = ex.qaDays.find((x) => x.coupleId === cid && x.day === day);
    if (!d) return null;
    const mine = ex.qaAnswers.find((x) => x.coupleId === cid && x.userId === uid && x.day === day);
    const theirs = ex.qaAnswers.find((x) => x.coupleId === cid && x.userId !== uid && x.day === day);
    const legacy = (t: string) => (t.startsWith("\u0000") ? (t.slice(1) as "a" | "b") : null);
    const ans = (r: MockQaAnswerRow) => ({ text: legacy(r.text) ? "" : r.text, choice: legacy(r.text), at: r.at });
    return {
      day: d.day,
      ref: d.ref,
      custom: d.custom,
      setBy: d.setBy,
      mine: mine ? ans(mine) : null,
      theirsAnswered: !!theirs,
      theirs: mine && theirs ? ans(theirs) : null,
    };
  }
  getQa(uid: string, todayRef: string): Res<{ qa: QaSnapshot }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const ex = this.ex(s);
    const today = this.today();
    const tomorrow = addDaysIso(today, 1);
    if (REF_RE.test(todayRef) && !ex.qaDays.some((d) => d.coupleId === cid && d.day === today)) {
      ex.qaDays.push({ coupleId: cid, day: today, ref: todayRef, custom: null, setBy: null });
      this.write(s);
    }
    const days: QaDay[] = [];
    for (const d of [...ex.qaDays].filter((x) => x.coupleId === cid && x.day <= tomorrow).sort((a, b) => (a.day < b.day ? 1 : -1))) {
      const answered = ex.qaAnswers.some((a) => a.coupleId === cid && a.day === d.day);
      if (d.day >= today || d.ref === "custom" || answered) {
        const j = this.dayJson(s, cid, uid, d.day);
        if (j) days.push(j);
      }
    }
    const me = s.members.find((m) => m.userId === uid);
    return { ok: true, qa: { today, tomorrow, tomorrowTurn: me?.role === tomorrowAuthorRole(today), days } };
  }
  answerQa(uid: string, a: { day: string; ref: string; text: string; key: string }): Res<{ day: QaDay }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const today = this.today();
    const t = a.text.trim();
    if (a.day > today || a.day < addDaysIso(today, -1) || t.length < 1 || t.length > ANSWER_MAX || a.key.length < 8)
      return { ok: false, error: "invalid_content" };
    const ex = this.ex(s);
    if (ex.qaAnswers.some((x) => x.coupleId === cid && x.userId === uid && x.day === a.day)) {
      const j = this.dayJson(s, cid, uid, a.day);
      return j ? { ok: true, day: j } : { ok: false, error: "invalid_action" };
    }
    if (REF_RE.test(a.ref) && !ex.qaDays.some((d) => d.coupleId === cid && d.day === a.day))
      ex.qaDays.push({ coupleId: cid, day: a.day, ref: a.ref, custom: null, setBy: null });
    if (!ex.qaDays.some((d) => d.coupleId === cid && d.day === a.day)) return { ok: false, error: "invalid_action" };
    ex.qaAnswers.push({ coupleId: cid, userId: uid, day: a.day, text: t, at: this.clock() });
    this.write(s);
    this.ping(cid, uid, "qa");
    return { ok: true, day: this.dayJson(s, cid, uid, a.day)! };
  }
  setTomorrowQuestion(uid: string, text: string): Res<{ day: QaDay }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const today = this.today();
    const me = s.members.find((m) => m.userId === uid);
    if (me?.role !== tomorrowAuthorRole(today)) return { ok: false, error: "not_your_turn" };
    const t = cleanQuestion(text);
    if (t.length < TOMORROW_MIN || t.length > TOMORROW_MAX) return { ok: false, error: "invalid_content" };
    const ex = this.ex(s);
    const tomorrow = addDaysIso(today, 1);
    const cur = ex.qaDays.find((d) => d.coupleId === cid && d.day === tomorrow);
    if (cur) {
      if (!ex.qaAnswers.some((a) => a.coupleId === cid && a.day === tomorrow)) Object.assign(cur, { ref: "custom", custom: t, setBy: uid });
    } else ex.qaDays.push({ coupleId: cid, day: tomorrow, ref: "custom", custom: t, setBy: uid });
    this.write(s);
    this.ping(cid, uid, "qa");
    return { ok: true, day: this.dayJson(s, cid, uid, tomorrow)! };
  }

  // ---------- ricordi ----------
  private memoriesOf(s: MockState, cid: string): Memory[] {
    return this.ex(s)
      .memories.filter((m) => m.coupleId === cid && !m.deleted)
      .map(({ coupleId: _c, deleted: _d, ...m }) => m)
      .sort((a, b) => (a.day !== b.day ? (a.day < b.day ? 1 : -1) : b.createdAt - a.createdAt));
  }
  getMemories(uid: string): Res<{ memories: Memory[] }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    return { ok: true, memories: this.memoriesOf(s, cid) };
  }
  addMemory(
    uid: string,
    a: { id: string; kind: MemoryKind; source: MemorySource; caption: string; day: string; path: string | null; w: number | null; h: number | null; bytes: number | null; content: Memory["content"] },
  ): Res<{ memory: Memory; duplicate?: boolean }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const ex = this.ex(s);
    const cur = ex.memories.find((m) => m.id === a.id);
    if (cur) {
      if (cur.coupleId !== cid) return { ok: false, error: "invalid_action" };
      const { coupleId: _c, deleted: _d, ...m } = cur;
      return { ok: true, memory: m, duplicate: true };
    }
    const cap = cleanCaption(a.caption);
    if (!["photo", "draw", "text"].includes(a.kind) || (a.kind === "photo") !== (a.source === "photo") || a.caption.trim().length > 120 || a.day > addDaysIso(this.today(), 1))
      return { ok: false, error: "invalid_action" };
    if (a.kind === "photo") {
      if (!a.path || !new RegExp(`^${cid}/[0-9a-f-]{36}\\.jpg$`).test(a.path) || !a.w || !a.h || !a.bytes || a.bytes > 1048576) return { ok: false, error: "invalid_action" };
      if (!ex.files[a.path]) return { ok: false, error: "no_file" };
    } else if (a.path || !a.content || validateContent(a.kind, a.content) !== null) return { ok: false, error: "invalid_content" };
    const row: MockMemoryRow = {
      id: a.id, coupleId: cid, deleted: false, kind: a.kind, source: a.source, caption: cap, day: a.day, path: a.path, w: a.w, h: a.h,
      bytes: a.bytes, content: a.kind === "photo" ? null : a.content, by: uid, createdAt: this.clock(),
    };
    ex.memories.push(row);
    this.write(s);
    this.ping(cid, uid, "memories");
    const { coupleId: _c, deleted: _d, ...m } = row;
    return { ok: true, memory: m };
  }
  deleteMemory(uid: string, id: string): Res<{ path: string | null }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const cur = this.ex(s).memories.find((m) => m.id === id && m.coupleId === cid);
    if (!cur) return { ok: true, path: null };
    if (cur.by !== uid) return { ok: false, error: "not_yours" };
    if (!cur.deleted) {
      cur.deleted = true;
      this.write(s);
      this.ping(cid, uid, "memories");
    }
    return { ok: true, path: cur.path };
  }
  // Storage finto: stessa regola delle policy (solo la cartella della propria coppia).
  uploadFile(uid: string, path: string, dataUri: string): Res {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if (!path.startsWith(`${cid}/`)) return { ok: false, error: "not_paired" };
    const ex = this.ex(s);
    if (!ex.files[path]) ex.files[path] = dataUri;
    this.write(s);
    return { ok: true };
  }
  removeFile(uid: string, path: string): Res {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid || !path.startsWith(`${cid}/`)) return { ok: false, error: "not_paired" };
    const ex = this.ex(s);
    const owner = ex.memories.find((m) => m.path === path);
    if (owner && owner.by !== uid) return { ok: true }; // come la policy: 0 righe cancellate
    delete ex.files[path];
    this.write(s);
    return { ok: true };
  }
  signFiles(uid: string, paths: string[]): Res<{ urls: Record<string, string> }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const ex = this.ex(s);
    const urls: Record<string, string> = {};
    for (const p of paths) if (p.startsWith(`${cid}/`) && ex.files[p]) urls[p] = ex.files[p];
    return { ok: true, urls };
  }

  // ---------- il nostro mese ----------
  getMonth(uid: string, year: number, month: number): Res<{ month: MonthRaw }> {
    const s = this.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if (!(year >= 2000 && year <= 2100 && month >= 1 && month <= 12)) return { ok: false, error: "invalid_action" };
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const inMonth = (at: number) => romeDayKey(at).startsWith(key);
    const lastPerDay = new Map<string, { u: string; d: string; m: MonthRaw["moods"][number]["m"]; at: number }>();
    for (const m of s.moods) {
      if (m.coupleId !== cid || !inMonth(m.at)) continue;
      const d = romeDayKey(m.at);
      const k = `${m.userId}|${d}`;
      const cur = lastPerDay.get(k);
      if (!cur || m.at >= cur.at) lastPerDay.set(k, { u: m.userId, d, m: m.moodId, at: m.at });
    }
    const pings: Record<string, number> = {};
    for (const p of s.pings) if (p.coupleId === cid && inMonth(p.at)) pings[p.fromUser] = (pings[p.fromUser] ?? 0) + 1;
    const games: Record<string, number> = {};
    const db = s.games?.[cid];
    for (const g of db?.games ?? []) if (g.status === "done" && g.finishedAt && inMonth(g.finishedAt)) games[g.kind] = (games[g.kind] ?? 0) + 1;
    const ex = this.ex(s);
    const perDay = new Map<string, number>();
    for (const a of ex.qaAnswers) if (a.coupleId === cid && a.day.startsWith(key)) perDay.set(a.day, (perDay.get(a.day) ?? 0) + 1);
    return {
      ok: true,
      month: {
        year,
        month,
        moods: [...lastPerDay.values()].map(({ at: _at, ...r }) => r).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.u < b.u ? -1 : 1)),
        pings,
        games,
        qaBoth: [...perDay.values()].filter((n) => n === 2).length,
      },
    };
  }
}
