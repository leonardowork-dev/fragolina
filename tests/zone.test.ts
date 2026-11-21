import { describe, expect, it } from "vitest";

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
