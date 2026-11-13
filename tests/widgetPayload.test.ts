import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { WIDGET_SCHEMA_VERSION } from "@/config/couple";
import { emptyPet } from "@/lib/pet/rules";
import {
  QUESTION_MAX,
  buildSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  snapshotSignature,
  type WidgetSnapshot,
} from "@/lib/widgetPayload";

const root = path.resolve(__dirname, "..");
const fixtureRaw = fs.readFileSync(path.join(root, "tests/fixtures/widget-snapshot.json"), "utf8");
const fixture = JSON.parse(fixtureRaw) as WidgetSnapshot;
const v2Raw = fs.readFileSync(path.join(root, "tests/fixtures/widget-snapshot-v2.json"), "utf8");
const v3Raw = fs.readFileSync(path.join(root, "tests/fixtures/widget-snapshot-v3.json"), "utf8");
const v1Raw = fs.readFileSync(path.join(root, "tests/fixtures/widget-snapshot-v1.json"), "utf8");

const baseSource = {
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
  meName: "Leonardo",
  myMood: { moodId: "carica", at: fixture.myMoodAt! },
  question: { text: "Cena di sabato: cosa vince?", myAnswer: "a", partnerAnswer: null },
  myUserId: "ua",
  // il pet della fixture v4: germoglio "Bacca", curato da lei (ub) con una mora, oggi in due
  pet: {
    ...emptyPet(),
    hatchedAt: 1794000000000,
    name: "Bacca",
    food: 640,
    love: 820,
    energy: 410,
    at: 1794571200000 - 1800000,
    lastAt: 1794571200000 - 1800000,
    careDays: 3,
    bothDays: 1,
    day: "2026-11-12",
    dayA: true,
    dayB: true,
    lastBy: "ub",
    lastKind: "feed" as const,
    lastItem: "mora" as const,
  },
};

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
    expect(buildSnapshot(baseSource, fixture.updatedAt + 5000, "2026-11-12")).toEqual(fixture);
  });
  it("domanda: entrambi hanno risposto solo se ci sono due risposte; testo lungo tagliato a 60", () => {
    const both = buildSnapshot(
      { ...baseSource, question: { text: "x".repeat(200), myAnswer: "a", partnerAnswer: "b" } },
      1,
      "2026-11-12",
    );
    expect(both.questionBothDone).toBe(true);
    expect(both.questionMineDone).toBe(true);
    expect(both.questionText.length).toBe(QUESTION_MAX);
    expect(both.questionText.endsWith("…")).toBe(true);
    const none = buildSnapshot(
      { ...baseSource, question: { text: "Boh?", myAnswer: null, partnerAnswer: null } },
      1,
      "2026-11-12",
    );
    expect(none).toMatchObject({ questionMineDone: false, questionBothDone: false, questionText: "Boh?" });
  });
  it("il mio umore e il mio nome passano; senza umore restano vuoti", () => {
    const s = buildSnapshot({ ...baseSource, myMood: null }, 1, "2026-11-12");
    expect(s).toMatchObject({ myName: "Leonardo", myMoodId: null, myMoodLabel: "", myMoodAt: null });
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
        meName: "Leo",
        myMood: { moodId: "felice", at: 2 },
        question: { text: "Domanda", myAnswer: "a", partnerAnswer: "b" },
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
      myMoodId: null,
      questionText: "",
      questionMineDone: false,
      questionBothDone: false,
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
        meName: "L",
        myMood: null,
        question: null,
      },
      99,
      "2026-11-12",
    );
    expect(snap.thinkingToday).toBe(0);
    expect(snap.updatedAt).toBe(10);
  });
  it("legge la fixture v1 (senza `paired`, senza campi nuovi) senza lanciare", () => {
    const v1 = decodeSnapshot(v1Raw);
    expect(v1).toMatchObject({
      v: 1,
      paired: true,
      partnerName: "Nikole",
      moodId: "felice",
      thinkingToday: 2,
      pingsReceived: 0,
      lastPingAt: null,
      myName: "",
      myMoodId: null,
      questionText: "",
      questionMineDone: false,
      questionBothDone: false,
    });
  });
  it("legge la fixture v2 (compatibilità all'indietro): i campi v3 prendono i valori di base", () => {
    const v2 = decodeSnapshot(v2Raw)!;
    expect(v2.v).toBe(2);
    expect(v2).toMatchObject({
      paired: true,
      partnerName: "Nikole",
      moodId: "innamorata",
      pingsReceived: 41,
      startDate: "2025-02-14",
      myName: "",
      myMoodId: null,
      myMoodLabel: "",
      myMoodAt: null,
      questionText: "",
      questionMineDone: false,
      questionBothDone: false,
    });
    // il v2 e il v3 coincidono su tutti i campi che esistevano già
    for (const k of Object.keys(JSON.parse(v2Raw)).filter((x) => x !== "v"))
      expect((v2 as Record<string, unknown>)[k]).toEqual((fixture as Record<string, unknown>)[k]);
  });
  it("campi nuovi sconosciuti (v4 futuro) e tipi sbagliati non rompono la lettura", () => {
    const o = decodeSnapshot('{"v":4,"updatedAt":9,"partnerName":"N","qualcosaDiNuovo":{"a":1},"questionMineDone":"sì","myMoodAt":"ieri"}');
    expect(o).toMatchObject({ v: 4, partnerName: "N", questionMineDone: false, myMoodAt: null });
  });
  it("legge un payload corrotto senza lanciare", () => {
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
  const swift = fs.readFileSync(path.join(root, "targets/widget/Model.swift"), "utf8");
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
  it("le chiavi v2 sono un prefisso delle chiavi v3 (si aggiunge in fondo, mai si cambia)", () => {
    const v2keys = Object.keys(JSON.parse(v2Raw));
    expect(Object.keys(fixture).slice(0, v2keys.length)).toEqual(v2keys);
  });
  it("gli interi della fixture che Swift legge come Int sono interi (niente decimali)", () => {
    for (const f of fields.filter((x) => x.type === "Int"))
      expect(Number.isInteger((fixture as Record<string, unknown>)[f.name])).toBe(true);
  });
});

describe("payload v4: il pet", () => {
  const snap = (over: Record<string, unknown> = {}) =>
    buildSnapshot({ ...baseSource, ...over } as typeof baseSource, fixture.updatedAt, "2026-11-12");
  it("la fixture v3 (senza pet) si legge ancora: campi del pet vuoti", () => {
    const d = decodeSnapshot(v3Raw)!;
    expect(d.v).toBe(3);
    expect(d).toMatchObject({ petHatched: false, petStage: "", petName: "", petFood: 0, petAt: null, petBoth: false, petLastKind: "" });
    expect(d.partnerName).toBe("Nikole");
  });
  it("v1 e v2 si leggono come prima", () => {
    expect(decodeSnapshot(v1Raw)).toMatchObject({ v: 1, petHatched: false });
    expect(decodeSnapshot(v2Raw)).toMatchObject({ v: 2, petStage: "" });
  });
  it("i campi del pet stanno IN FONDO e in questo ordine (mai in mezzo)", () => {
    const keys = Object.keys(fixture);
    expect(keys.slice(-14)).toEqual([
      "petHatched", "petStage", "petName", "petFood", "petLove", "petEnergy", "petAt",
      "petSleepUntil", "petLastAt", "petDay", "petBoth", "petLastBy", "petLastKind", "petLastItem",
    ]);
    expect(keys.slice(-15)[0]).toBe("questionBothDone");
  });
  it("non collegati: nessun pet, stadio vuoto", () => {
    const s = snap({ coupleId: null, members: [] });
    expect(s).toMatchObject({ petHatched: false, petStage: "", petName: "", petFood: 0, petLastBy: "" });
  });
  it("collegati senza pet sul server: uovo", () => {
    expect(snap({ pet: null })).toMatchObject({ petHatched: false, petStage: "egg", petName: "" });
    expect(snap({ pet: emptyPet() })).toMatchObject({ petHatched: false, petStage: "egg" });
  });
  it("chi ha curato per ultimo: 'me' se sono io, 'partner' se è lei; vuoto se l'ultima azione è un cambio di nome", () => {
    expect(snap().petLastBy).toBe("partner");
    expect(snap({ myUserId: "ub" }).petLastBy).toBe("me");
    const named = snap({ pet: { ...baseSource.pet, lastKind: "name" as const } });
    expect(named).toMatchObject({ petLastBy: "", petLastKind: "", petLastItem: "" });
  });
  it("una nanna in corso e il giorno 'in due' passano allo snapshot", () => {
    const s = snap({ pet: { ...baseSource.pet, sleepUntil: 1794575000000, dayB: false } });
    expect(s).toMatchObject({ petSleepUntil: 1794575000000, petBoth: false });
  });
  it("il valore di un tipo sbagliato nel pet vale 'vuoto' ma non butta via il resto", () => {
    const d = decodeSnapshot('{"v":4,"partnerName":"N","petFood":"tanto","petStage":3,"petHatched":"si","petName":"Bacca"}')!;
    expect(d).toMatchObject({ petFood: 0, petStage: "", petHatched: false, petName: "Bacca", partnerName: "N" });
  });
});
