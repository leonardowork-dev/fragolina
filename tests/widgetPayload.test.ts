import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { WIDGET_SCHEMA_VERSION } from "@/config/couple";
import {
  buildSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  snapshotSignature,
  type WidgetSnapshot,
} from "@/lib/widgetPayload";

const root = path.resolve(__dirname, "..");
const fixtureRaw = fs.readFileSync(path.join(root, "tests/fixtures/widget-snapshot.json"), "utf8");
const fixture = JSON.parse(fixtureRaw) as WidgetSnapshot;

describe("payload del widget (TypeScript ↔ fixture condivisa)", () => {
  it("la fixture ha la versione dello schema corrente", () => {
    expect(fixture.v).toBe(WIDGET_SCHEMA_VERSION);
  });
  it("decode(fixture) restituisce esattamente i valori della fixture", () => {
    expect(decodeSnapshot(fixtureRaw)).toEqual(fixture);
  });
  it("encode → decode è un giro completo senza perdite", () => {
    expect(decodeSnapshot(encodeSnapshot(fixture))).toEqual(fixture);
    expect(JSON.parse(encodeSnapshot(fixture))).toEqual(fixture);
  });
  it("l'ordine delle chiavi è stabile e coincide con la fixture", () => {
    expect(Object.keys(JSON.parse(encodeSnapshot(fixture)))).toEqual(Object.keys(fixture));
  });
  it("buildSnapshot da una coppia vera produce la fixture", () => {
    const snap = buildSnapshot(
      {
        coupleId: "c",
        members: [1, 2],
        partnerName: "Nikole",
        partnerMood: { moodId: "innamorata", at: fixture.moodAt! },
        pingsDay: "2026-11-12",
        pingsSentToday: 3,
        pingsReceivedTotal: 41,
        lastPingReceivedAt: fixture.lastPingAt,
        startDate: "2025-02-14",
        lastSyncAt: fixture.updatedAt,
      },
      fixture.updatedAt + 5000,
      "2026-11-12",
    );
    expect(snap).toEqual(fixture);
  });
  it("non collegati: niente umore, niente pensieri, updatedAt = adesso", () => {
    const snap = buildSnapshot(
      {
        coupleId: null,
        members: [],
        partnerName: "Nikole",
        partnerMood: { moodId: "felice", at: 1 },
        pingsDay: "2026-11-12",
        pingsSentToday: 9,
        pingsReceivedTotal: 9,
        lastPingReceivedAt: 5,
        startDate: null,
        lastSyncAt: 1,
      },
      777,
      "2026-11-12",
    );
    expect(snap).toMatchObject({
      paired: false,
      moodId: null,
      thinkingToday: 0,
      pingsReceived: 0,
      lastPingAt: null,
      startDate: null,
      updatedAt: 777,
    });
  });
  it("il contatore di 'oggi' è zero se il giorno è cambiato", () => {
    const snap = buildSnapshot(
      {
        coupleId: "c",
        members: [1, 2],
        partnerName: "N",
        partnerMood: null,
        pingsDay: "2026-11-11",
        pingsSentToday: 9,
        pingsReceivedTotal: 9,
        lastPingReceivedAt: null,
        startDate: null,
        lastSyncAt: 10,
      },
      99,
      "2026-11-12",
    );
    expect(snap.thinkingToday).toBe(0);
    expect(snap.updatedAt).toBe(10);
  });
  it("legge un payload vecchio (v1) e uno corrotto senza lanciare", () => {
    const v1 = decodeSnapshot(
      '{"v":1,"updatedAt":5,"partnerName":"Nikole","moodId":"felice","moodLabel":"Felice","thinkingToday":2,"startDate":"2025-02-14"}',
    );
    expect(v1).toMatchObject({
      v: 1,
      paired: true,
      moodId: "felice",
      thinkingToday: 2,
      pingsReceived: 0,
      lastPingAt: null,
    });
    expect(decodeSnapshot("{non json")).toBeNull();
    expect(decodeSnapshot("null")).toBeNull();
    expect(decodeSnapshot('{"thinkingToday":"tre","updatedAt":"ieri"}')).toMatchObject({
      thinkingToday: 0,
      updatedAt: 0,
    });
  });
  it("la firma ignora updatedAt (niente riscritture inutili)", () => {
    expect(snapshotSignature({ ...fixture, updatedAt: 1 })).toBe(
      snapshotSignature({ ...fixture, updatedAt: 999 }),
    );
    expect(snapshotSignature({ ...fixture, thinkingToday: 4 })).not.toBe(
      snapshotSignature(fixture),
    );
  });
  it("nomi con accenti ed emoji sopravvivono al giro", () => {
    const s = { ...fixture, partnerName: "Zoë 🍓 Àngela" };
    expect(decodeSnapshot(encodeSnapshot(s))?.partnerName).toBe("Zoë 🍓 Àngela");
  });
});

describe("modello Swift Codable ↔ fixture", () => {
  const swift = fs.readFileSync(path.join(root, "targets/widget/FragolinaWidget.swift"), "utf8");
  const block = /struct Snapshot: Codable \{([\s\S]*?)\n\}/.exec(swift)?.[1] ?? "";
  const fields = [...block.matchAll(/var (\w+): (\w+)\?/g)].map((m) => ({
    name: m[1],
    type: m[2],
  }));

  it("lo struct Snapshot esiste e tutti i campi sono opzionali", () => {
    expect(fields.length).toBeGreaterThan(5);
    const declared = block.split("\n").filter((l) => /^\s*var /.test(l));
    expect(declared.length).toBe(fields.length);
  });
  it("le chiavi sono le stesse della fixture, nello stesso ordine", () => {
    expect(fields.map((f) => f.name)).toEqual(Object.keys(fixture));
  });
  it("ogni tipo Swift è compatibile con il valore JSON della fixture", () => {
    for (const f of fields) {
      const v = (fixture as Record<string, unknown>)[f.name];
      const kind = v === null ? "null" : typeof v;
      const ok =
        kind === "null" ||
        (f.type === "Int" && Number.isInteger(v)) ||
        (f.type === "Double" && kind === "number") ||
        (f.type === "String" && kind === "string") ||
        (f.type === "Bool" && kind === "boolean");
      expect(ok, `${f.name}: ${f.type} vs ${kind}`).toBe(true);
    }
  });
  it("gli interi della fixture che Swift legge come Int sono interi (niente decimali)", () => {
    for (const f of fields.filter((x) => x.type === "Int"))
      expect(Number.isInteger((fixture as Record<string, unknown>)[f.name])).toBe(true);
  });
});
