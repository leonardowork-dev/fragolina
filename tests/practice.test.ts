import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { BOT_ID, ME_ID, trisBotMove } from "@/lib/games/bot";
import { PRACTICE_DRAWINGS, PRACTICE_WORDS } from "@/lib/games/practiceDrawings";
import type { DrawData, QuizData, TrisData } from "@/lib/games/types";
import { WORD_DECK } from "@/lib/games/wordDeck";
import { validateContent } from "@/lib/note/rules";
import { createPracticeStore } from "@/state/practiceStore";

const mem = (): StateStorage => {
  const d = new Map<string, string>();
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, v), removeItem: (k) => void d.delete(k) };
};
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const mk = (rng = () => 0.5) => createPracticeStore({ storage: mem(), name: `p-${Math.random()}`, rng });

describe("Fragolina: disegni preregistrati", () => {
  it("ogni disegno è valido come un biglietto e la sua parola sta nel mazzo", () => {
    expect(PRACTICE_WORDS.length).toBeGreaterThanOrEqual(8);
    for (const [w, d] of Object.entries(PRACTICE_DRAWINGS)) {
      expect(validateContent("draw", d), `disegno ${w}`).toBeNull();
      expect(WORD_DECK.includes(w), `parola ${w} nel mazzo`).toBe(true);
    }
  });
});

describe("Fragolina: tris", () => {
  it("vince se può, blocca se serve, prende il centro", () => {
    expect(trisBotMove("OO-XX----", "O", () => 0.99, 0)).toBe(2); // O completa 0-1-2
    expect(trisBotMove("XX-O-----", "O", () => 0.99, 0)).toBe(2); // blocca X
    expect(trisBotMove("X--------", "O", () => 0.99, 0)).toBe(4);
  });
  it("a volte sbaglia apposta (mossa a caso), ma sempre su una casella libera", () => {
    for (let i = 0; i < 40; i++) {
      const c = trisBotMove("XOXOX----", "O", () => (i % 9) / 9, 1);
      expect("XOXOX----"[c]).toBe("-");
    }
  });
  it("una partita intera contro il giocatore finisce sempre (vince uno o pareggio) e mette a punteggio", () => {
    for (let k = 0; k < 20; k++) {
      let n = 0;
      const rng = () => ((n = (n * 7 + 3 + k) % 101) + 0.5) / 102;
      const P = mk(rng);
      const r = P.getState().start("tris");
      if (!r.ok) throw new Error("start");
      for (let i = 0; i < 12; i++) {
        const g = P.getState().db.games[0];
        if (g.status !== "open") break;
        if (g.turn === BOT_ID) expect(P.getState().step("tris")).toBe(true);
        else {
          const cell = [...(g.data as TrisData).board].findIndex((c) => c === "-");
          P.getState().move(g.id, { type: "place", cell });
        }
      }
      expect(P.getState().db.games[0].status).toBe("done");
      expect(P.getState().snapshot().scores.tris?.[ME_ID]?.played).toBe(1);
    }
  });
});

describe("Fragolina: quiz", () => {
  it("risponde da sola su di sé; indovina solo dopo la tua risposta; tutta la partita arriva alla fine", () => {
    const P = mk(seq(0.1, 0.4, 0.8));
    const r = P.getState().start("quiz");
    if (!r.ok) throw new Error("start");
    let g = P.getState().db.games[0];
    const d0 = g.data as QuizData;
    // la Fragolina ha già risposto alle domande in cui è lei il soggetto (e a nessuna delle altre)
    for (let i = 0; i < 10 && P.getState().step("quiz"); i++); // le sue risposte "su di sé", una alla volta
    g = P.getState().db.games[0];
    const d1 = g.data as QuizData;
    d1.subjects.forEach((s, q) => {
      if (s === BOT_ID) expect(d1.answered[q].s).toBe(true);
      else expect(d1.answered[q].g).toBe(false);
    });
    expect(d0.answered.every((a) => !a.s && !a.g)).toBe(true);
    for (let i = 0; i < 40; i++) {
      g = P.getState().db.games[0];
      if (g.status !== "open") break;
      if (!P.getState().step("quiz")) {
        const d = g.data as QuizData;
        const q = d.subjects.findIndex((s, i2) => (s === ME_ID ? !d.answered[i2].s : !d.answered[i2].g));
        P.getState().move(g.id, { type: "answer", q, idx: 0 });
      }
    }
    expect(P.getState().db.games[0].status).toBe("done");
  });
});

describe("Fragolina: disegna e indovina", () => {
  it("la prima volta disegna lei: manda un disegno preregistrato, tu indovini (3 tentativi), la parola si rivela", () => {
    const P = mk(seq(0.2, 0.7));
    const r = P.getState().start("draw");
    if (!r.ok) throw new Error("start");
    let g = P.getState().db.games[0];
    expect((g.data as DrawData).drawer).toBe(BOT_ID);
    expect(P.getState().botWaiting("draw")).toBe(true);
    expect(P.getState().step("draw")).toBe(true);
    g = P.getState().db.games[0];
    expect((g.data as DrawData).phase).toBe("guessing");
    expect((g.data as DrawData).drawing?.strokes.length).toBeGreaterThan(0);
    expect(g.turn).toBe(ME_ID);
    for (let i = 0; i < 3; i++) P.getState().move(g.id, { type: "guess", text: "xyz" + i });
    g = P.getState().db.games[0];
    expect(g.status).toBe("done");
    expect(g.result).toMatchObject({ solved: false });
    expect((g.data as DrawData).word).toBeTruthy();
  });
  it("la volta dopo disegni tu e la Fragolina prova a indovinare (a volte sbaglia)", () => {
    const P = mk(() => 0.9);
    P.getState().start("draw");
    P.getState().step("draw");
    P.getState().abandon(P.getState().db.games[0].id);
    const r = P.getState().start("draw");
    if (!r.ok) throw new Error("start");
    const g = P.getState().db.games.at(-1)!;
    expect((g.data as DrawData).drawer).toBe(ME_ID);
    P.getState().move(g.id, { type: "drawing", content: PRACTICE_DRAWINGS.sole });
    expect(P.getState().step("draw")).toBe(true); // la Fragolina tenta
    expect(P.getState().db.games.at(-1)!.data as DrawData).toHaveProperty("guesses");
  });
});

describe("prova locale: isolamento e persistenza", () => {
  it("abbandona e ricomincia; reset azzera tutto; lo stato è solo locale (nessun import dal backend)", () => {
    const P = mk();
    const a = P.getState().start("tris");
    expect(a.ok).toBe(true);
    expect(P.getState().start("tris")).toMatchObject({ ok: false, error: "game_open" });
    P.getState().abandon(P.getState().db.games[0].id);
    expect(P.getState().start("tris").ok).toBe(true);
    P.getState().reset();
    expect(P.getState().db.games).toHaveLength(0);
  });
});
