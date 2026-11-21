import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { type ZoneCtx, emptyZoneDb, zoneApply, zoneSnapshot } from "@/lib/zone/engine";
import { replayZone } from "@/lib/zone/replay";
import { zoneSnapshotFromJson } from "@/lib/zone/wire";
import { emptyZSnapshot } from "@/lib/zone/types";

import { DECK, DECK_BY_ID } from "@/lib/zone/deck";
import { countsByDay, heartsFor, milestones, monthGrid, newMilestone, zoneStats } from "@/lib/zone/stats";
import type { ZEntry } from "@/lib/zone/types";

const e = (day: string, over: Partial<ZEntry> = {}): ZEntry => ({ id: day + Math.random(), day, at: 0, place: null, starter: null, rating: null, note: null, by: null, updatedAt: 0, ...over });

describe("zona: cuoricini e calendario", () => {
  it("fino a 5 cuoricini, oltre un cuore grande con il numero", () => {
    expect(heartsFor(0)).toEqual({ small: 0, big: null });
    expect(heartsFor(3)).toEqual({ small: 3, big: null });
    expect(heartsFor(5)).toEqual({ small: 5, big: null });
    expect(heartsFor(7)).toEqual({ small: 0, big: 7 });
  });
  it("griglia del mese da lunedì (novembre 2026 inizia di domenica)", () => {
    const g = monthGrid(2026, 11);
    expect(g.length % 7).toBe(0);
    expect(g.indexOf("2026-11-01")).toBe(6);
    expect(g.filter(Boolean)).toHaveLength(30);
  });
  it("conta per giorno", () => {
    expect(countsByDay([e("2026-11-01"), e("2026-11-01"), e("2026-11-02")]).get("2026-11-01")).toBe(2);
  });
});

describe("zona: statistiche e traguardi", () => {
  const list = [
    e("2026-11-02", { place: "letto", rating: 5, starter: "a" }),
    e("2026-11-02", { place: "doccia", rating: 3, starter: "b" }),
    e("2026-11-03", { place: "letto", rating: 4, starter: "both" }),
    e("2026-11-04", { place: "letto" }),
    e("2026-10-20"),
  ];
  const s = zoneStats(list, "2026-11-04", "a");
  it("totali, mese, record, serie, posto, media, chi inizia", () => {
    expect(s.total).toBe(5);
    expect(s.thisMonth).toBe(4);
    expect(s.recordDay).toEqual({ day: "2026-11-02", count: 2 });
    expect(s.streak).toBe(3);
    expect(s.favoritePlace).toBe("letto");
    expect(s.avgRating).toBe(4);
    expect(s.starter).toEqual({ me: 1, you: 1, both: 1 });
    expect(s.hottestWeek?.count).toBe(4);
  });
  it("la serie vale anche se l'ultimo giorno è ieri", () => {
    expect(zoneStats(list, "2026-11-05", null).streak).toBe(3);
    expect(zoneStats(list, "2026-11-08", null).streak).toBe(0);
  });
  it("traguardi: primo, cinque in un giorno, tutte le stanze", () => {
    const five = Array.from({ length: 5 }, () => e("2026-11-10"));
    expect(milestones([], "2026-11-10").size).toBe(0);
    expect(milestones([e("2026-11-10")], "2026-11-10").has("first")).toBe(true);
    expect(milestones(five, "2026-11-10").has("five_day")).toBe(true);
    const rooms = (["letto", "divano", "doccia", "auto", "fuori"] as const).map((p, i) => e(`2026-11-0${i + 1}`, { place: p }));
    expect(milestones(rooms, "2026-11-10").has("all_rooms")).toBe(true);
    expect(newMilestone(new Set(), new Set(["first"]))).toBe("first");
    expect(newMilestone(new Set(["first"]), new Set(["first"]))).toBeNull();
  });
});

describe("zona: mazzo dei desideri", () => {
  it("almeno 80 idee, id per posizione, tre livelli, nessun doppione", () => {
    expect(DECK.length).toBeGreaterThanOrEqual(80);
    expect(DECK[0]!.id).toBe("d001");
    expect(DECK_BY_ID.get("d002")?.text).toBe(DECK[1]!.text);
    expect(new Set(DECK.map((d) => d.level))).toEqual(new Set(["dolce", "piccante", "audace"]));
    expect(new Set(DECK.map((d) => d.text)).size).toBe(DECK.length);
    for (const d of DECK) expect(d.text.length).toBeLessThanOrEqual(90);
  });
  it("niente parole crude nel mazzo (repository pubblico)", () => {
    const bad = /\b(cazz|figa|puttan|scopar|troia|sborr|pompin)/i;
    for (const d of DECK) expect(bad.test(d.text), d.text).toBe(false);
  });
});


const members = [{ userId: "ua", role: "a" as const }, { userId: "ub", role: "b" as const }];
const ctx = (uid: string, now = 1_000_000): ZoneCtx => ({ uid, members, now, today: "2026-11-22" });
const L = (id: string, day = "2026-11-22") => ({ kind: "log" as const, key: "k" + id, id, day, at: 1, place: null, starter: null, rating: null, note: null });

describe("zona: motore (specchio SQL)", () => {
  it("A segna 3 volte, B vede 3 cuoricini", () => {
    const db = emptyZoneDb();
    for (const id of ["a", "b", "c"]) zoneApply(db, ctx("ua"), L(id));
    expect(zoneSnapshot(db, ctx("ub")).entries).toHaveLength(3);
  });
  it("desiderio scelto da uno solo resta segreto, da entrambi = match", () => {
    const db = emptyZoneDb();
    zoneApply(db, ctx("ua"), { kind: "wish", key: "1", idea: "d001", on: true });
    zoneApply(db, ctx("ua"), { kind: "wish", key: "2", idea: "d002", on: true });
    const b1 = zoneSnapshot(db, ctx("ub"));
    expect(b1.matches).toEqual([]);
    expect(JSON.stringify(b1)).not.toContain("d00");
    zoneApply(db, ctx("ub"), { kind: "wish", key: "3", idea: "d001", on: true });
    expect(zoneSnapshot(db, ctx("ua")).matches).toEqual(["d001"]);
    expect(zoneSnapshot(db, ctx("ub")).matches).toEqual(["d001"]);
    expect(JSON.stringify(zoneSnapshot(db, ctx("ub")))).not.toContain("d002");
  });
  it("stasera: si rivela solo se sì+sì o sì+forse; l'altro non vede cosa hai detto", () => {
    const db = emptyZoneDb();
    zoneApply(db, ctx("ua"), { kind: "tonight", key: "1", answer: "yes" });
    const b = zoneSnapshot(db, ctx("ub"));
    expect(b.tonight).toMatchObject({ otherAnswered: true, mine: null, result: null });
    zoneApply(db, ctx("ub"), { kind: "tonight", key: "2", answer: "maybe" });
    expect(zoneSnapshot(db, ctx("ua")).tonight.result).toBe("match");
    expect(zoneApply(db, ctx("ua"), { kind: "tonight", key: "3", answer: "no" })).toEqual({ ok: false, error: "already_answered" });
    const db2 = emptyZoneDb();
    zoneApply(db2, ctx("ua"), { kind: "tonight", key: "1", answer: "maybe" });
    zoneApply(db2, ctx("ub"), { kind: "tonight", key: "2", answer: "maybe" });
    expect(zoneSnapshot(db2, ctx("ub")).tonight.result).toBe("nomatch");
  });
  it("ho voglia: l'altro lo vede, scade da solo", () => {
    const db = emptyZoneDb();
    zoneApply(db, ctx("ua"), { kind: "signal", key: "1", level: 3 });
    expect(zoneSnapshot(db, ctx("ub")).signal.incoming?.level).toBe(3);
    expect(zoneSnapshot(db, ctx("ub", 1_000_000 + 2 * 3_600_000)).signal.incoming).toBeNull();
  });
  it("buoni: solo chi riceve riscatta; cancella tutto svuota", () => {
    const db = emptyZoneDb();
    zoneApply(db, ctx("ua"), { kind: "voucherAdd", key: "1", id: "v1", title: "Un massaggio", expires: null });
    expect(zoneApply(db, ctx("ua"), { kind: "voucherRedeem", key: "2", id: "v1" })).toEqual({ ok: false, error: "not_found" });
    expect(zoneApply(db, ctx("ub"), { kind: "voucherRedeem", key: "3", id: "v1" }).ok).toBe(true);
    zoneApply(db, ctx("ua"), L("x"));
    zoneApply(db, ctx("ub"), { kind: "wipe", key: "w" });
    const s = zoneSnapshot(db, ctx("ua"));
    expect(s.entries).toHaveLength(0);
    expect(s.vouchers).toHaveLength(0);
  });
  it("valori non validi rifiutati", () => {
    const db = emptyZoneDb();
    expect(zoneApply(db, ctx("ua"), { ...L("a"), rating: 9 }).ok).toBe(false);
    expect(zoneApply(db, ctx("ua"), { ...L("a"), day: "2099-01-01" }).ok).toBe(false);
    expect(zoneApply(db, ctx("ua"), { ...L("a"), note: "x".repeat(141) }).ok).toBe(false);
  });
});

describe("zona: vista ottimistica e lettura del server", () => {
  it("la coda si vede subito sopra la fotografia, senza inventare match", () => {
    const v = replayZone(emptyZSnapshot(), [L("a"), { kind: "wish", key: "w", idea: "d001", on: true }, { kind: "tonight", key: "t", answer: "yes" }], { role: "a" }, 5);
    expect(v.entries).toHaveLength(1);
    expect(v.wishesMine).toEqual(["d001"]);
    expect(v.matches).toEqual([]);
    expect(v.tonight.mine).toBe("yes");
    expect(v.tonight.result).toBeNull();
  });
  it("zoneSnapshotFromJson non lancia mai", () => {
    expect(zoneSnapshotFromJson(null).entries).toEqual([]);
    expect(zoneSnapshotFromJson({ entries: "x", tonight: 3 }).entries).toEqual([]);
    expect(zoneSnapshotFromJson({ ok: true, entries: [{ id: "a", day: "2026-11-01", by: "a" }] }).entries).toHaveLength(1);
  });
});

describe("zona: Backend finto a due telefoni", () => {
  it("passa dal server finto, solo il segnale arriva in tempo reale", async () => {
    const t = memoryTransport();
    const mk = (uid: string) => new MockBackend(t, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => Date.UTC(2026, 10, 22, 10) });
    const A = mk("ua"), B = mk("ub");
    const c = await A.createCouple("Leonardo", null);
    await B.joinCouple(c.code, "Nikole");
    let pulses = 0;
    const off = B.subscribeZone(c.coupleId, () => pulses++);
    for (const id of ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]) await A.zoneApply(L(id, "2026-11-22"));
    await new Promise((r) => setTimeout(r, 5));
    expect(pulses).toBeGreaterThan(0);
    expect((await B.zoneGet())!.entries).toHaveLength(3);
    off();
  });
});

describe("zona: privacy (mai nei widget, nel feed, nei log)", () => {
  const root = path.resolve(__dirname, "..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
  it("lo snapshot e il codice del widget non nominano la zona", () => {
    for (const f of ["src/lib/widgetPayload.ts", "src/features/widgetSync/writeSnapshot.ts", "src/lib/widgetBridge.ts"]) expect(/zone|zona|piccant/i.test(read(f)), f).toBe(false);
    for (const f of fs.readdirSync(path.join(root, "targets/widget")).filter((x) => x.endsWith(".swift"))) expect(/z_get|zone|piccant|\bwish/i.test(read(`targets/widget/${f}`)), f).toBe(false);
  });
  it("niente console.* nei file della zona", () => {
    for (const f of fs.readdirSync(path.join(root, "src/features/zone"))) expect(/console\./.test(read(`src/features/zone/${f}`)), f).toBe(false);
    for (const f of fs.readdirSync(path.join(root, "src/lib/zone"))) expect(/console\./.test(read(`src/lib/zone/${f}`)), f).toBe(false);
  });
  it("il feed SQL del widget non cita le tabelle z_", () => {
    const m = fs.readdirSync(path.join(root, "supabase/migrations")).filter((f) => !f.includes("_zona")).map((f) => read(`supabase/migrations/${f}`)).join("\n");
    expect(/\bz_(entries|wishes|tonight|signals|vouchers|ideas)\b/.test(m)).toBe(false);
  });
});

describe("zona: le animazioni non restano e non escono dalla zona (bug dei buoni)", () => {
  it("lo stato dell'animazione si accende con fire e si spegne con clear (scritta compresa)", async () => {
    const { useHeat } = await import("@/features/zone/heatStore");
    useHeat.getState().fire("match", "Riscattato!");
    expect(useHeat.getState()).toMatchObject({ active: true, label: "Riscattato!" });
    useHeat.getState().clear();
    expect(useHeat.getState()).toMatchObject({ active: false, label: null });
  });
  it("il livello esiste SOLO nella zona aperta e si spegne da solo (controllo statico)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/features/zone/HeatBurst.tsx"), "utf8");
    expect(src).toContain('pathname === "/zone" && unlocked');
    expect(src).toContain("setTimeout(() => useHeat.getState().clear()");
    expect(src).toContain("!active || !inZone");
  });
});
