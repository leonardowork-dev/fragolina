import { describe, expect, it } from "vitest";

import type { CountdownEvent } from "@/lib/countdown/rules";
import { monthRawFromJson, monthView } from "@/lib/memories/month";
import { replayMemories } from "@/lib/memories/sync";
import { buildTimeline, milestonesUntil, yearsAgoToday } from "@/lib/memories/timeline";
import { type Memory, cleanCaption, memoriesFromJson, photosThatFit } from "@/lib/memories/types";
import type { QaDay } from "@/lib/qa/rules";
import { enqueue } from "@/lib/sync/queue";
import type { QueuedOp } from "@/lib/sync/types";

const mem = (id: string, day: string, over: Partial<Memory> = {}): Memory => ({
  id, kind: "photo", source: "photo", caption: "", day, path: `c/${id}.jpg`, w: 1600, h: 1200, bytes: 300000, content: null, by: "ua", createdAt: 1, ...over,
});
const photoOp = (id: string, day = "2026-11-19"): QueuedOp => ({ key: "k" + id, kind: "memoryPhoto", at: 5, attempts: 0, id, uri: "file:///x.jpg", w: 1600, h: 1200, bytes: 300000, caption: "c", day });

describe("ricordi: vista ottimistica e coda", () => {
  it("una foto in coda si vede subito con 'pending' e il file locale; poi arriva dal server", () => {
    const list = replayMemories([mem("a", "2026-11-01")], [photoOp("b")], "ua", 9);
    expect(list.map((m) => m.id)).toEqual(["b", "a"]);
    expect(list[0]).toMatchObject({ pending: true, localUri: "file:///x.jpg", by: "ua" });
    // quando il server ce l'ha già, la coda non la duplica
    expect(replayMemories([mem("b", "2026-11-19")], [photoOp("b")], "ua", 9)).toHaveLength(1);
  });

  it("tenere un biglietto: id del biglietto, idempotente", () => {
    const keep: QueuedOp = { key: "k1", kind: "memoryAdd", at: 5, attempts: 0, id: "note-1", memKind: "text", source: "note", caption: "", day: "2026-11-19", content: { text: "ciao", bg: "sky" } };
    expect(replayMemories([], [keep, { ...keep, key: "k2" }], "ua", 9).filter((m) => m.id === "note-1")).toHaveLength(1);
  });

  it("cancellare una foto ancora in coda la fa sparire senza chiamate; una già sul server serve la cancellazione", () => {
    let q: QueuedOp[] = enqueue([], photoOp("b"));
    q = enqueue(q, { key: "d1", kind: "memoryDelete", at: 6, attempts: 0, id: "b", path: null });
    expect(q).toEqual([]);
    // ma se il file può già essere stato caricato (path noto) la cancellazione resta, per pulire lo Storage
    let q2: QueuedOp[] = enqueue([], photoOp("b"));
    q2 = enqueue(q2, { key: "d2", kind: "memoryDelete", at: 6, attempts: 0, id: "b", path: "c/b.jpg" });
    expect(q2.map((x) => x.kind)).toEqual(["memoryDelete"]);
    expect(replayMemories([mem("a", "2026-11-01")], [{ key: "d3", kind: "memoryDelete", at: 6, attempts: 0, id: "a", path: "c/a.jpg" }], "ua", 9)).toEqual([]);
  });

  it("didascalia corta e lettura del JSON; stima: ~2600 foto da 400 KB in 1 GB", () => {
    expect(cleanCaption("  una   riga\n sola  ")).toBe("una riga sola");
    expect(cleanCaption("x".repeat(500))).toHaveLength(120);
    expect(memoriesFromJson([{ id: "a", kind: "photo", source: "photo", day: "2026-11-01", path: "c/a.jpg", w: 10, h: 10, bytes: 5, by: "u", createdAt: 3 }, { id: 5 }, { id: "z", kind: "boh", day: "x" }])).toHaveLength(1);
    expect(photosThatFit(400 * 1024)).toBe(2621);
    expect(photosThatFit(500 * 1024)).toBe(2097);
  });
});

describe("ricordi: timeline, traguardi, un anno fa", () => {
  const qa = (d: string, withBoth = true): QaDay => ({ day: d, ref: "q001", custom: null, setBy: null, mine: { text: "a", choice: null, at: 1 }, theirsAnswered: withBoth, theirs: withBoth ? { text: "b", choice: null, at: 2 } : null });
  const event = (id: string, date: string): CountdownEvent => ({ id, title: id, date, time: null, icon: "heart", featured: false, at: 1 });

  it("traguardi di 'giorni insieme': 100, 200… e anniversari, solo quelli già raggiunti", () => {
    const m = milestonesUntil("2025-02-14", "2026-11-19");
    const labels = m.map((x) => x.label);
    expect(labels).toContain("100 giorni insieme");
    expect(labels).toContain("1 anno insieme");
    expect(labels).toContain("6 mesi insieme");
    expect(labels).toContain("18 mesi insieme");
    expect(labels).not.toContain("2 anni insieme");
    expect(labels).toContain("600 giorni insieme");
    expect(milestonesUntil(null, "2026-11-19")).toEqual([]);
    expect(milestonesUntil("2026-11-19", "2026-11-19")).toEqual([]);
  });

  it("l'album unisce foto, ricordi tenuti, eventi passati, risposte rivelate e traguardi, per mese (il più nuovo per primo)", () => {
    const tl = buildTimeline({
      memories: [mem("p1", "2026-11-10"), mem("p2", "2026-09-03"), mem("n1", "2026-11-12", { kind: "text", source: "note", path: null, content: { text: "ciao", bg: "sky" } })],
      events: [event("passato", "2026-10-05"), event("futuro", "2027-01-01")],
      qa: [qa("2026-11-17"), qa("2026-11-18", false)],
      startDate: "2025-02-14",
      today: "2026-11-19",
      nowMin: 600,
    });
    const keys = tl.map((m) => m.key);
    expect(keys).toEqual([...keys].sort().reverse());
    expect(keys).toEqual(expect.arrayContaining(["2026-11", "2026-10", "2026-09", "2026-08"])); // 2026-08 = 18 mesi insieme
    const nov = tl.find((m) => m.key === "2026-11")!;
    expect(nov.items.map((i) => i.type)).toEqual(expect.arrayContaining(["memory", "qa"]));
    expect(nov.items.filter((i) => i.type === "qa")).toHaveLength(1); // solo la risposta rivelata a entrambi
    expect(tl.find((m) => m.key === "2026-10")!.items.some((i) => i.type === "event")).toBe(true);
    expect(tl.flatMap((m) => m.items).some((i) => i.type === "event" && i.event.id === "futuro")).toBe(false);
    // ordine dentro il mese: giorno più recente per primo
    const days = nov.items.map((i) => i.day);
    expect(days).toEqual([...days].sort().reverse());
  });

  it("un anno fa oggi: solo lo stesso giorno e mese di anni passati; nessun rumore se non c'è niente", () => {
    const tl = buildTimeline({
      memories: [mem("ieri-anno", "2025-11-19"), mem("due-anni", "2024-11-19", { caption: "due" }), mem("altro", "2025-11-20")],
      events: [event("ev", "2025-11-19")],
      qa: [],
      startDate: "2025-02-14",
      today: "2026-11-19",
      nowMin: 600,
    });
    const y = yearsAgoToday(tl, "2026-11-19");
    expect(y.map((x) => x.yearsAgo)).toEqual([1, 1, 2]);
    expect(yearsAgoToday(tl, "2026-03-03")).toEqual([]);
    expect(yearsAgoToday([], "2026-11-19")).toEqual([]);
  });
});

describe("il nostro mese", () => {
  it("umori di entrambi, più frequente, pensieri e partite", () => {
    const raw = monthRawFromJson({
      year: 2026, month: 11,
      moods: [{ u: "ua", d: "2026-11-02", m: "felice" }, { u: "ua", d: "2026-11-05", m: "felice" }, { u: "ua", d: "2026-11-09", m: "stanca" }, { u: "ub", d: "2026-11-02", m: "innamorata" }],
      pings: { ua: 7, ub: 3 }, games: { tris: 2, quiz: 1 }, qaBoth: 4,
    })!;
    const v = monthView(raw, "ua");
    expect(v.daysInMonth).toBe(30);
    expect(v.topMine).toEqual({ mood: "felice", n: 2 });
    expect(v.topTheirs).toEqual({ mood: "innamorata", n: 1 });
    expect(v.days[1]).toMatchObject({ day: 2, mine: "felice", theirs: "innamorata" });
    expect(v).toMatchObject({ pingsMine: 7, pingsTheirs: 3, games: 3, qaBoth: 4 });
    // da dove guarda l'altra persona i ruoli si scambiano
    expect(monthView(raw, "ub")).toMatchObject({ pingsMine: 3, pingsTheirs: 7 });
  });
  it("mese vuoto e JSON storto", () => {
    const v = monthView(monthRawFromJson({ year: 2026, month: 2, moods: [], pings: {}, games: {}, qaBoth: 0 })!, "ua");
    expect(v.daysInMonth).toBe(28);
    expect(v.topMine).toBeNull();
    expect(monthRawFromJson({ foo: 1 })).toBeNull();
  });
});
