import { describe, expect, it } from "vitest";

import { EVENT_ICONS, ICON_SHAPES } from "@/lib/countdown/icons";
import {
  type CountdownEvent,
  countdownTimelineMs,
  countdownView,
  isValidDate,
  pastEvents,
  pickCountdown,
  upcomingEvents,
  validateEvent,
  widgetEvents,
} from "@/lib/countdown/rules";
import { eventsFromJson, replayEvents } from "@/lib/countdown/sync";
import { enqueue } from "@/lib/sync/queue";
import type { QueuedOp } from "@/lib/sync/types";

const ev = (id: string, date: string, over: Partial<CountdownEvent> = {}): CountdownEvent => ({
  id, title: id, date, time: null, icon: "heart", featured: false, at: 1, ...over,
});

describe("conto alla rovescia: regole pure", () => {
  it("validazione: titolo, data vera, ora, simbolo", () => {
    const ok = { title: "Ci vediamo", date: "2026-12-20", time: "18:30", icon: "heart" as const, featured: false };
    expect(validateEvent(ok)).toBeNull();
    expect(validateEvent({ ...ok, title: "   " })).toBe("title");
    expect(validateEvent({ ...ok, date: "2026-02-30" })).toBe("date");
    expect(validateEvent({ ...ok, date: "1999-01-01" })).toBe("date");
    expect(validateEvent({ ...ok, time: "25:00" })).toBe("time");
    expect(validateEvent({ ...ok, time: null })).toBeNull();
    expect(validateEvent({ ...ok, icon: "💥" as never })).toBe("icon");
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
  });

  it("giorni: numero di mezzanotti, anche a cavallo del cambio dell'ora legale", () => {
    expect(countdownView({ date: "2026-11-20", time: null }, "2026-11-12", 0)).toMatchObject({ state: "days", daysUntil: 8, big: "8", unit: "giorni" });
    expect(countdownView({ date: "2026-11-13", time: null }, "2026-11-12", 700)).toMatchObject({ big: "1", unit: "giorno" });
    // fine ottobre 2026: il 25 ha 25 ore, ma i giorni di calendario sono 3
    expect(countdownView({ date: "2026-10-27", time: null }, "2026-10-24", 0).daysUntil).toBe(3);
  });

  it("l'ultimo giorno: senza ora 'oggi', con l'ora ore → minuti → 'ora!' → passato", () => {
    const e = { date: "2026-12-20", time: "18:30" };
    const at = (nowMin: number) => countdownView(e, "2026-12-20", nowMin);
    expect(countdownView({ date: "2026-12-20", time: null }, "2026-12-20", 5)).toMatchObject({ state: "today", unit: "oggi" });
    expect(at(8 * 60)).toMatchObject({ state: "hours", big: "11", unit: "ore" });
    expect(at(18 * 60 + 30 - 61)).toMatchObject({ state: "hours", big: "2" });
    expect(at(18 * 60 + 30 - 60)).toMatchObject({ state: "minutes", big: "60" });
    expect(at(18 * 60 + 30 - 1)).toMatchObject({ state: "minutes", big: "1" });
    expect(at(18 * 60 + 30)).toMatchObject({ state: "now" });
    expect(at(18 * 60 + 30 + 59)).toMatchObject({ state: "now" });
    expect(at(18 * 60 + 30 + 60)).toMatchObject({ state: "passed" });
    expect(countdownView(e, "2026-12-21", 0).state).toBe("passed");
  });

  it("l'evento in primo piano: l'in-evidenza se non è passato, altrimenti il più vicino", () => {
    const list = [ev("tardi", "2027-03-01"), ev("presto", "2026-11-20"), ev("evid", "2027-06-01", { featured: true })];
    expect(pickCountdown(list, "2026-11-12", 0)?.id).toBe("evid");
    expect(pickCountdown(list.map((e) => ({ ...e, featured: false })), "2026-11-12", 0)?.id).toBe("presto");
    // l'in-evidenza è passato → si torna al più vicino
    expect(pickCountdown([ev("vecchio", "2026-11-01", { featured: true }), ev("presto", "2026-11-20")], "2026-11-12", 0)?.id).toBe("presto");
    expect(pickCountdown([ev("vecchio", "2026-11-01")], "2026-11-12", 0)).toBeNull();
    expect(pickCountdown([], "2026-11-12", 0)).toBeNull();
  });

  it("prossimi e passati, in ordine", () => {
    const list = [ev("b", "2026-12-01"), ev("a", "2026-11-15"), ev("p1", "2026-10-01"), ev("p2", "2026-11-01")];
    expect(upcomingEvents(list, "2026-11-12", 0).map((e) => e.id)).toEqual(["a", "b"]);
    expect(pastEvents(list, "2026-11-12", 0).map((e) => e.id)).toEqual(["p2", "p1"]); // i più recenti prima
  });

  it("per il widget: al massimo 5, in evidenza per primo, niente di più vecchio di ieri", () => {
    const list = [
      ev("e1", "2026-11-30"), ev("e2", "2026-12-01"), ev("e3", "2026-12-02"), ev("e4", "2026-12-03"), ev("e5", "2026-12-04"),
      ev("e6", "2026-12-05"), ev("ieri", "2026-11-11"), ev("vecchio", "2026-10-01"), ev("evid", "2027-05-05", { featured: true }),
    ];
    const w = widgetEvents(list, "2026-11-12").map((e) => e.id);
    expect(w).toHaveLength(5);
    expect(w[0]).toBe("evid");
    expect(w).not.toContain("vecchio");
    expect(w).toContain("ieri");
  });

  it("timeline del widget: adesso, tre mezzanotti, e per l'evento con l'ora ogni 30 min, l'ora, la fine della festa", () => {
    const now = Date.UTC(2026, 11, 20, 12, 0, 0);
    const tl = countdownTimelineMs({ date: "2026-12-20", time: "18:30" }, now, 0);
    expect(tl[0]).toBe(now);
    expect(tl).toEqual([...tl].sort((a, b) => a - b));
    const t = Date.UTC(2026, 11, 20, 18, 30);
    expect(tl).toContain(t);
    expect(tl).toContain(t + 1000);
    expect(tl).toContain(t + 3_600_000 + 1000);
    expect(tl).toContain(t - 30 * 60_000);
    expect(tl).toContain(Date.UTC(2026, 11, 21, 0, 0, 10)); // mezzanotte successiva
    expect(new Set(tl).size).toBe(tl.length);
    // senza evento: solo adesso e le mezzanotti
    expect(countdownTimelineMs(null, now, 0)).toHaveLength(4);
  });

  it("simboli: dieci, tutti con tracciati M L C Z", () => {
    expect(EVENT_ICONS).toHaveLength(10);
    for (const id of EVENT_ICONS) {
      expect(ICON_SHAPES[id].length).toBeGreaterThan(0);
      for (const s of ICON_SHAPES[id]) expect(s.d).toMatch(/^[MLCZ0-9 .\-]+$/);
    }
  });
});

describe("conto alla rovescia: vista ottimistica e coda", () => {
  const upsert = (e: CountdownEvent, key = e.id): QueuedOp => ({ key, kind: "eventUpsert", at: e.at, attempts: 0, event: e });

  it("un evento in coda si vede subito; una modifica più vecchia del server non vince", () => {
    const server = [ev("a", "2026-12-01", { title: "Server", at: 500 })];
    expect(replayEvents(server, [upsert(ev("b", "2026-12-02", { at: 600 }))]).map((e) => e.id).sort()).toEqual(["a", "b"]);
    expect(replayEvents(server, [upsert(ev("a", "2026-12-09", { title: "Vecchia", at: 100 }))])[0]!.title).toBe("Server");
    expect(replayEvents(server, [upsert(ev("a", "2026-12-09", { title: "Nuova", at: 900 }))])[0]).toMatchObject({ title: "Nuova", date: "2026-12-09" });
  });

  it("un solo evento in evidenza: mettendolo, si toglie agli altri", () => {
    const server = [ev("a", "2026-12-01", { featured: true }), ev("b", "2026-12-02")];
    const out = replayEvents(server, [upsert(ev("b", "2026-12-02", { featured: true, at: 5 }))]);
    expect(out.filter((e) => e.featured).map((e) => e.id)).toEqual(["b"]);
  });

  it("cancellazione: sparisce subito; in coda l'ultima modifica sostituisce le precedenti", () => {
    let q: QueuedOp[] = [];
    q = enqueue(q, upsert(ev("a", "2026-12-01", { title: "uno", at: 1 }), "k1"));
    q = enqueue(q, upsert(ev("a", "2026-12-01", { title: "due", at: 2 }), "k2"));
    expect(q.filter((x) => x.kind === "eventUpsert")).toHaveLength(1);
    q = enqueue(q, { key: "k3", kind: "eventDelete", at: 3, attempts: 0, id: "a" });
    expect(q.map((x) => x.kind)).toEqual(["eventDelete"]);
    expect(replayEvents([ev("a", "2026-12-01")], q)).toEqual([]);
  });

  it("eventsFromJson scarta le righe storte e legge l'ora e chi", () => {
    const out = eventsFromJson([{ id: "x", title: "T", date: "2026-12-01", time: "09:05", icon: "star", featured: true, at: 7, by: "u" }, { id: 3 }, null, "boh"]);
    expect(out).toEqual([{ id: "x", title: "T", date: "2026-12-01", time: "09:05", icon: "star", featured: true, at: 7, by: "u" }]);
  });
});
