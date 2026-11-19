import { describe, expect, it } from "vitest";

import { BANK, bankQuestion } from "@/lib/qa/bank";
import { answerText, dayQuestion, legacyChoiceText, legacyText } from "@/lib/qa/legacy";
import {
  ANSWER_MAX,
  type QaDay,
  archiveOf,
  cleanAnswer,
  cleanQuestion,
  legacyRef,
  norm,
  orderFor,
  qaSnapshotFromJson,
  questionRefForDay,
  tomorrowAuthorRole,
} from "@/lib/qa/rules";
import { applyQueuedAnswers, mergeQaDay, qaTodayView } from "@/lib/qa/sync";
import { S } from "@/lib/strings.it";
import { addDaysIso, epochDay, romeDayKey, romeOffsetMin } from "@/lib/time";

describe("domanda del giorno: il mazzo", () => {
  it("almeno 365 domande italiane, id unici in ordine, testi unici, tutte con il punto di domanda", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(365);
    expect(new Set(BANK.map((q) => q.id)).size).toBe(BANK.length);
    expect(new Set(BANK.map((q) => q.text)).size).toBe(BANK.length);
    BANK.forEach((q, i) => {
      expect(q.id).toBe(`q${String(i + 1).padStart(3, "0")}`);
      expect(q.text.endsWith("?"), q.text).toBe(true);
      expect(q.text.length).toBeLessThan(140);
      expect(bankQuestion(q.id)).toBe(q);
    });
  });

  it("cinque categorie, tutte presenti; niente gelosie né imbarazzi (parole vietate)", () => {
    const cats = new Set(BANK.map((q) => q.cat));
    expect([...cats].sort()).toEqual(["g", "l", "n", "r", "s"]);
    for (const q of BANK) expect(q.text, q.id).not.toMatch(/\b(ex|geloso|gelosa|tradi|tradire|bugia|sesso|sessuale|nud[oi]|soldi|stipendio)\b/i);
  });

  it("ordine deterministico per coppia: stessa coppia = stessa domanda, coppie diverse = ordini diversi", () => {
    expect(questionRefForDay("coppia-1", "2026-11-19")).toBe(questionRefForDay("coppia-1", "2026-11-19"));
    expect(orderFor("coppia-1")).not.toEqual(orderFor("coppia-2"));
    expect(orderFor("coppia-1")).toHaveLength(BANK.length);
    expect(new Set(orderFor("coppia-1")).size).toBe(BANK.length);
  });

  it("nessuna ripetizione per più di un anno", () => {
    for (const couple of ["a", "b", "uuid-1234"]) {
      const seen = new Set<string>();
      let day = "2026-01-01";
      for (let i = 0; i < 365; i++) {
        seen.add(questionRefForDay(couple, day));
        day = addDaysIso(day, 1);
      }
      expect(seen.size, couple).toBe(365);
    }
  });

  it("le domande della versione base si ritrovano: id 'l-…' e testo, con le due scelte", () => {
    expect(legacyRef("q-sabato")).toBe("l-sabato");
    for (const q of S.questions) {
      expect(legacyRef(q.id)).toMatch(/^l-[a-z0-9-]{1,40}$/);
      expect(legacyText(legacyRef(q.id))).toBe(q.text);
      expect(legacyChoiceText(legacyRef(q.id), "a")).toBe(q.a);
      expect(legacyChoiceText(legacyRef(q.id), "b")).toBe(q.b);
    }
    const d = { ref: "l-sabato", custom: null };
    expect(dayQuestion(d)).toBe("Cena di sabato: cosa vince?");
    expect(answerText(d, { text: "", choice: "b" })).toBe("Ristorante vero");
    expect(dayQuestion({ ref: "custom", custom: "La mia?" })).toBe("La mia?");
  });
});

describe("domanda del giorno: giorno di Roma", () => {
  it("scarto: +1 in inverno, +2 in estate; cambi alle 01:00 UTC dell'ultima domenica di marzo e ottobre", () => {
    expect(romeOffsetMin(Date.UTC(2026, 0, 15))).toBe(60);
    expect(romeOffsetMin(Date.UTC(2026, 6, 15))).toBe(120);
    expect(romeOffsetMin(Date.UTC(2026, 2, 29, 0, 59, 59))).toBe(60);
    expect(romeOffsetMin(Date.UTC(2026, 2, 29, 1, 0, 0))).toBe(120);
    expect(romeOffsetMin(Date.UTC(2026, 9, 25, 0, 59, 59))).toBe(120);
    expect(romeOffsetMin(Date.UTC(2026, 9, 25, 1, 0, 0))).toBe(60);
  });
  it("il giorno cambia a mezzanotte di Roma, non del telefono", () => {
    expect(romeDayKey(Date.UTC(2026, 10, 19, 22, 59, 59))).toBe("2026-11-19");
    expect(romeDayKey(Date.UTC(2026, 10, 19, 23, 0, 0))).toBe("2026-11-20");
    expect(romeDayKey(Date.UTC(2026, 5, 19, 21, 59, 59))).toBe("2026-06-19"); // estate: 22:00 UTC = mezzanotte
    expect(romeDayKey(Date.UTC(2026, 5, 19, 22, 0, 0))).toBe("2026-06-20");
  });
  it("a turni: domani scrive il ruolo a se il numero del giorno è pari, b se dispari; si alternano", () => {
    let day = "2026-11-19";
    let prev = tomorrowAuthorRole(day);
    for (let i = 0; i < 20; i++) {
      day = addDaysIso(day, 1);
      const r = tomorrowAuthorRole(day);
      expect(r).not.toBe(prev);
      prev = r;
    }
    expect(tomorrowAuthorRole("2026-11-19")).toBe(epochDay("2026-11-20") % 2 === 0 ? "a" : "b");
  });
});

describe("domanda del giorno: testi, vista e archivio", () => {
  const day = (d: string, mine: string | null, theirs: string | null, q = "q001"): QaDay => ({
    day: d, ref: q, custom: null, setBy: null,
    mine: mine === null ? null : { text: mine, choice: null, at: 1 },
    theirsAnswered: theirs !== null,
    theirs: mine !== null && theirs !== null ? { text: theirs, choice: null, at: 2 } : null,
  });

  it("risposta: massimo 280 caratteri, si pulisce; domanda di domani: 140", () => {
    expect(cleanAnswer("  ciao  ")).toBe("ciao");
    expect(cleanAnswer("x".repeat(400))).toHaveLength(ANSWER_MAX);
    expect(cleanQuestion("  a   b\n c ")).toBe("a b c");
    expect(cleanQuestion("y".repeat(300))).toHaveLength(140);
  });

  it("la mia risposta in coda si vede subito, quella dell'altro MAI dal telefono", () => {
    const view = qaTodayView(null, [{ key: "k", kind: "qaAnswer", at: 5, attempts: 0, day: "2026-11-19", ref: "q001", text: "ciao" }], "c1", "2026-11-19", 9);
    expect(view.mine?.text).toBe("ciao");
    expect(view.theirs).toBeNull();
    expect(view.ref).toBe(questionRefForDay("c1", "2026-11-19"));
    const server = { today: "2026-11-19", tomorrow: "2026-11-20", tomorrowTurn: false, days: [day("2026-11-19", null, "segreta")] };
    expect(server.days[0]!.theirs).toBeNull(); // il server non la manda finché non rispondi
    const merged = qaTodayView(server, [{ key: "k", kind: "qaAnswer", at: 5, attempts: 0, day: "2026-11-19", ref: "q001", text: "ciao" }], "c1", "2026-11-19", 9);
    expect(merged.theirs).toBeNull();
    expect(merged.theirsAnswered).toBe(true);
  });

  it("mergeQaDay e risposte in coda per ieri", () => {
    const s = mergeQaDay(null, day("2026-11-18", "a", null), "2026-11-19");
    expect(s.days).toHaveLength(1);
    expect(mergeQaDay(s, day("2026-11-18", "a", "b"), "2026-11-19").days[0]!.theirs?.text).toBe("b");
    const q = applyQueuedAnswers([day("2026-11-18", null, null)], [{ key: "k", kind: "qaAnswer", at: 5, attempts: 0, day: "2026-11-18", ref: "q001", text: "ieri" }]);
    expect(q[0]!.mine?.text).toBe("ieri");
  });

  it("archivio: solo giorni passati in cui HAI risposto, dal più recente; ricerca senza accenti né maiuscole", () => {
    const days = [
      day("2026-11-19", "oggi", "oggi2"),
      day("2026-11-17", "Un caffè sul balcone", "La pizza"),
      day("2026-11-16", "Il treno", "Il màre di maggio"),
      day("2026-11-15", null, "risposta che non vedi"),
    ];
    const text = (d: QaDay) => bankQuestion(d.ref)!.text;
    expect(archiveOf(days, "2026-11-19", text).map((d) => d.day)).toEqual(["2026-11-17", "2026-11-16"]);
    expect(archiveOf(days, "2026-11-19", text, "MARE").map((d) => d.day)).toEqual(["2026-11-16"]);
    expect(archiveOf(days, "2026-11-19", text, "caffe").map((d) => d.day)).toEqual(["2026-11-17"]);
    expect(archiveOf(days, "2026-11-19", text, "primo ricordo").length).toBe(2); // parola nella domanda
    expect(archiveOf(days, "2026-11-19", text, "zzzz")).toEqual([]);
    expect(norm("Màre È")).toBe("mare e");
  });

  it("lettura del JSON del server", () => {
    const s = qaSnapshotFromJson({ today: "2026-11-19", tomorrow: "2026-11-20", tomorrowTurn: true, days: [{ day: "2026-11-19", ref: "q001", custom: null, setBy: null, mine: { text: "x", choice: null, at: 3 }, theirsAnswered: true, theirs: null }, { ref: 3 }] });
    expect(s?.tomorrowTurn).toBe(true);
    expect(s?.days).toHaveLength(1);
    expect(s?.days[0]?.theirs).toBeNull();
    expect(qaSnapshotFromJson(null)).toBeNull();
  });
});
