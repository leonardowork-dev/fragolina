import { describe, expect, it } from "vitest";

import { hubOrder, pendingTurn, scoreSummary } from "@/lib/games/hub";
import type { GameRow, QuizData, TrisData } from "@/lib/games/types";

const ME = "me";
const THEM = "them";
let n = 0;
const tris = (o: Partial<GameRow> & { turn: string | null }): GameRow => ({
  id: `t${n++}`, kind: "tris", status: "open", rev: 2, result: null, createdBy: ME, createdAt: 1000, updatedAt: 2000, finishedAt: null,
  data: { x: ME, o: THEM, board: "X--------", win: null } as TrisData, ...o,
});
const quiz = (answered: { s: boolean; g: boolean }[], subjects: string[], o: Partial<GameRow> = {}): GameRow => ({
  id: `q${n++}`, kind: "quiz", status: "open", turn: null, rev: 2, result: null, createdBy: ME, createdAt: 1000, updatedAt: 3000, finishedAt: null,
  data: { qids: [1, 2, 3, 4, 5], subjects, answered, reveals: [null, null, null, null, null], score: 0 } as QuizData, ...o,
});
const empty5 = () => Array.from({ length: 5 }, () => ({ s: false, g: false }));

describe("schermata Gioca: cosa va in primo piano", () => {
  it("domina la partita in cui tocca a te, anche se un'altra è più recente", () => {
    const g = [tris({ turn: THEM, updatedAt: 9000 }), quiz(empty5(), [ME, THEM, ME, THEM, ME])];
    const { dominant, others } = hubOrder(g, ME);
    expect(dominant.kind).toBe("quiz");
    expect(dominant.turn).toBe("mine");
    expect(others.map((o) => o.kind)).toEqual(["tris", "draw"]);
  });
  it("fra due in cui tocca a te vince la più recente", () => {
    const g = [tris({ turn: ME, updatedAt: 5000 }), quiz(empty5(), [ME, THEM, ME, THEM, ME], { updatedAt: 7000 })];
    expect(hubOrder(g, ME).dominant.kind).toBe("quiz");
  });
  it("se aspetti l'altra persona, domina quella partita", () => {
    const g = [tris({ turn: THEM })];
    const { dominant } = hubOrder(g, ME);
    expect(dominant).toMatchObject({ kind: "tris", turn: "theirs" });
  });
  it("niente di aperto: il gioco mai giocato (o giocato meno di recente) è il suggerito", () => {
    expect(hubOrder([], ME).dominant.kind).toBe("tris"); // pari: l'ordine fisso
    const done = [tris({ turn: null, status: "done", finishedAt: 5000 })];
    expect(hubOrder(done, ME).dominant.kind).toBe("quiz"); // tris giocato, quiz e disegno mai
  });
  it("quiz: tocca a te finché hai risposte da dare, poi aspetti", () => {
    const a = empty5();
    const subj = [ME, THEM, ME, THEM, ME];
    // io ho risposto a tutte le mie parti, l'altra no
    subj.forEach((s, i) => (a[i][s === ME ? "s" : "g"] = true));
    expect(hubOrder([quiz(a, subj)], ME).dominant).toMatchObject({ kind: "quiz", turn: "theirs" });
  });
  it("invito in Home: solo se tocca a te", () => {
    expect(pendingTurn([tris({ turn: THEM })], ME)).toBeNull();
    expect(pendingTurn([tris({ turn: ME })], ME)?.kind).toBe("tris");
    expect(pendingTurn([], ME)).toBeNull();
    expect(pendingTurn([tris({ turn: ME, status: "done" })], ME)).toBeNull();
  });
  it("riepilogo dei punteggi", () => {
    const s = scoreSummary(
      { tris: { me: { wins: 7, draws: 1, played: 17 }, them: { wins: 9, draws: 1, played: 17 } }, quiz: { me: { wins: 31, draws: 0, played: 45 } } },
      "me",
      "them",
    );
    expect(s.tris).toEqual({ mine: 7, theirs: 9, draws: 1, played: 17 });
    expect(s.quiz).toEqual({ right: 31, total: 45 });
    expect(s.draw).toBeNull();
  });
});
