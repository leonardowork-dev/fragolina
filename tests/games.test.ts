import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { dbAbandon, dbMove, dbSnapshot, dbStart, emptyGamesDb } from "@/lib/games/engine";
import { QUIZ_DECK } from "@/lib/games/quizDeck";
import { ALBUM_MAX, DRAW_MAX_GUESSES, QUIZ_LEN, trisFull, trisWinner, whoseTurn } from "@/lib/games/reducer";
import type { DrawData, GameMove, GameParams, GameRow, QuizData, TrisData } from "@/lib/games/types";
import { normWord, sameWord } from "@/lib/games/words";
import { WORD_DECK } from "@/lib/games/wordDeck";

const A = "A";
const B = "B";
const U: [string, string] = [A, B];
const draw = (n = 3) => ({ strokes: [{ c: "ink" as const, w: 1 as const, p: Array.from({ length: n }, (_, i) => [10 + i, 20 + i] as [number, number]) }] });
let t = 1000;
const gid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("mazzi", () => {
  it("almeno 60 domande, 3-4 opzioni, testi per chi risponde e per chi indovina", () => {
    expect(QUIZ_DECK.length).toBeGreaterThanOrEqual(60);
    for (const [i, q] of QUIZ_DECK.entries()) {
      expect(q.options.length, `domanda ${i}`).toBeGreaterThanOrEqual(3);
      expect(q.options.length, `domanda ${i}`).toBeLessThanOrEqual(4);
      expect(q.them, `domanda ${i}`).toContain("{n}");
      expect(q.you.endsWith("?") || q.you.endsWith("…"), `domanda ${i}: ${q.you}`).toBe(true);
      expect(new Set(q.options).size, `opzioni uguali in ${i}`).toBe(q.options.length);
    }
    expect(new Set(QUIZ_DECK.map((q) => q.you)).size).toBe(QUIZ_DECK.length);
  });
  it("almeno 150 parole, uniche, minuscole, disegnabili (non troppo lunghe)", () => {
    expect(WORD_DECK.length).toBeGreaterThanOrEqual(150);
    expect(new Set(WORD_DECK).size).toBe(WORD_DECK.length);
    for (const w of WORD_DECK) {
      expect(w).toBe(w.toLowerCase());
      expect(w.length).toBeGreaterThanOrEqual(2);
      expect(w.length).toBeLessThanOrEqual(26);
    }
  });
});

describe("parole: maiuscole, accenti, articoli, plurali", () => {
  it("normalizza", () => {
    expect(normWord("  Il   GATTO! ")).toBe("gatto");
    expect(normWord("Caffè")).toBe("caffe");
    expect(normWord("L'ombrello")).toBe("ombrello");
    expect(normWord("lo zaino")).toBe("zaino");
    expect(normWord("la")).toBe("la"); // solo articolo: resta
    expect(normWord("stella marina")).toBe("stellamarina");
    expect(normWord("ÈÀÙ")).toBe("eau");
  });
  it("accetta plurali semplici e rifiuta il resto", () => {
    for (const [a, b] of [["gatti", "gatto"], ["Case", "casa"], ["fiori", "fiore"], ["caffè", "CAFFE"], ["un cane", "cane"], ["pesci", "pesce"]])
      expect(sameWord(a, b), `${a}/${b}`).toBe(true);
    for (const [a, b] of [["gatto", "cane"], ["", "casa"], ["sole", "luna"], ["mela", "pera"], ["re", "ra"], ["tre", "te"]])
      expect(sameWord(a, b), `${a}/${b}`).toBe(false);
  });
});

describe("tris", () => {
  it("righe vincenti, pareggio, pieno", () => {
    expect(trisWinner("XXX------")?.line).toEqual([0, 1, 2]);
    expect(trisWinner("O--O--O--")?.line).toEqual([0, 3, 6]);
    expect(trisWinner("X---X---X")?.mark).toBe("X");
    expect(trisWinner("--O-O-O--")?.line).toEqual([2, 4, 6]);
    expect(trisWinner("XOXXOOOXX")).toBeNull();
    expect(trisFull("XOXXOOOXX")).toBe(true);
  });
  const play = (cells: number[], first = A) => {
    const db = emptyGamesDb();
    const s = dbStart(db, U, first, gid(1), "tris", {}, t++);
    if (!s.ok) throw new Error("start");
    let who = first;
    let last: GameRow = s.game;
    cells.forEach((c, i) => {
      const r = dbMove(db, U, who, gid(1), { type: "place", cell: c }, `k${i}`, t++);
      if (!r.ok) throw new Error(`mossa ${i}: ${r.error}`);
      last = r.game;
      who = who === A ? B : A;
    });
    return { db, last };
  };
  it("una partita intera: vince chi fa tre in fila, il punteggio sale", () => {
    const { db, last } = play([0, 3, 1, 4, 2]);
    expect(last.status).toBe("done");
    expect((last.data as TrisData).win).toEqual([0, 1, 2]);
    expect(last.result).toEqual({ winner: A });
    expect(db.scores.tris?.[A]).toEqual({ wins: 1, draws: 0, played: 1 });
    expect(db.scores.tris?.[B]).toEqual({ wins: 0, draws: 0, played: 1 });
  });
  it("pareggio: nessun vincitore, 1 pareggio a testa", () => {
    const { db, last } = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(last.result).toEqual({ winner: null });
    expect(db.scores.tris?.[A]?.draws).toBe(1);
  });
  it("mossa fuori turno, casella occupata, casella inesistente, partita finita", () => {
    const db = emptyGamesDb();
    dbStart(db, U, A, gid(1), "tris", {}, t++);
    const r = (who: string, cell: number, k: string) => dbMove(db, U, who, gid(1), { type: "place", cell }, k, t++);
    expect(r(B, 0, "k1")).toMatchObject({ ok: false, error: "not_your_turn" });
    expect(r(A, 9, "k2")).toMatchObject({ ok: false, error: "invalid_move" });
    expect(r(A, 0, "k3").ok).toBe(true);
    expect(r(B, 0, "k4")).toMatchObject({ ok: false, error: "cell_taken" });
    expect(r(A, 1, "k5")).toMatchObject({ ok: false, error: "not_your_turn" });
  });
  it("idempotente: la stessa chiave non ripete la mossa", () => {
    const db = emptyGamesDb();
    dbStart(db, U, A, gid(1), "tris", {}, t++);
    const a = dbMove(db, U, A, gid(1), { type: "place", cell: 4 }, "stessa-chiave", t++);
    const b = dbMove(db, U, A, gid(1), { type: "place", cell: 4 }, "stessa-chiave", t++);
    expect(a.ok && b.ok && b.duplicate).toBe(true);
    expect((db.games[0].data as TrisData).board).toBe("----X----");
  });
  it("chi inizia si alterna a ogni partita; una sola aperta alla volta", () => {
    const db = emptyGamesDb();
    const g1 = dbStart(db, U, A, gid(1), "tris", {}, 1);
    expect(g1.ok && (g1.game.data as TrisData).x).toBe(A);
    expect(dbStart(db, U, B, gid(2), "tris", {}, 2)).toMatchObject({ ok: false, error: "game_open" });
    dbAbandon(db, U, A, gid(1), 3);
    const g2 = dbStart(db, U, A, gid(3), "tris", {}, 4);
    expect(g2.ok && (g2.game.data as TrisData).x).toBe(B); // l'altro inizia, anche se a premere "Rivincita" è A
    expect(g2.ok && g2.game.turn).toBe(B);
    expect(whoseTurn((g2 as { game: GameRow }).game, B)).toBe("mine");
    expect(whoseTurn((g2 as { game: GameRow }).game, A)).toBe("theirs");
  });
});

describe("quiz", () => {
  const start = (db = emptyGamesDb(), first = A) => {
    const r = dbStart(db, U, first, gid(1), "quiz", { qids: [3, 7, 11, 20, 42] }, t++);
    if (!r.ok) throw new Error(r.error);
    return { db, game: r.game };
  };
  it("5 domande, soggetti alternati, mazzo segnato", () => {
    const { db, game } = start();
    expect((game.data as QuizData).subjects).toEqual([A, B, A, B, A]);
    expect(db.decks.quiz).toEqual([3, 7, 11, 20, 42]);
  });
  it("domande non valide: poche, ripetute, fuori scala", () => {
    for (const qids of [[1, 2, 3], [1, 1, 2, 3, 4], [1, 2, 3, 4, -1], [1, 2, 3, 4, 5000]])
      expect(dbStart(emptyGamesDb(), U, A, gid(1), "quiz", { qids }, 1)).toMatchObject({ ok: false, error: "invalid_game" });
  });
  it("la risposta di uno NON si vede finché l'altro non risponde (nessun valore nello stato pubblico)", () => {
    const { db } = start();
    const r = dbMove(db, U, A, gid(1), { type: "answer", q: 0, idx: 2 }, "a0", t++);
    expect(r.ok).toBe(true);
    const pub = JSON.stringify(db.games[0]);
    expect(pub).not.toContain('"s":2');
    expect((db.games[0].data as QuizData).answered[0]).toEqual({ s: true, g: false });
    expect((db.games[0].data as QuizData).reveals[0]).toBeNull();
    // B non vede il segreto di A nella sua fotografia, A sì il proprio
    expect(dbSnapshot(db, B).mine).toEqual({});
    expect(dbSnapshot(db, A).mine[gid(1)]).toEqual({ qs: { "0": { s: 2 } } });
  });
  it("quando rispondono entrambi si rivela: giusta = +1; si chiude dopo 5; punteggio di sintonia", () => {
    const { db } = start();
    let n = 0;
    for (let q = 0; q < QUIZ_LEN; q++) {
      const subject = (db.games[0].data as QuizData).subjects[q];
      const guesser = subject === A ? B : A;
      dbMove(db, U, subject, gid(1), { type: "answer", q, idx: 1 }, `s${q}`, t++);
      const r = dbMove(db, U, guesser, gid(1), { type: "answer", q, idx: q % 2 === 0 ? 1 : 2 }, `g${q}`, t++);
      expect(r.ok).toBe(true);
      if (q % 2 === 0) n++;
    }
    const g = db.games[0];
    expect(g.status).toBe("done");
    expect(g.result).toEqual({ score: n, total: 5 });
    expect((g.data as QuizData).reveals.every((x) => x !== null)).toBe(true);
    expect(db.scores.quiz?.[A]?.wins).toBe(n);
    expect(db.scores.quiz?.[B]?.played).toBe(5);
  });
  it("già risposto → già risposto; indice fuori scala → mossa non valida", () => {
    const { db } = start();
    dbMove(db, U, A, gid(1), { type: "answer", q: 0, idx: 0 }, "a", t++);
    expect(dbMove(db, U, A, gid(1), { type: "answer", q: 0, idx: 1 }, "b", t++)).toMatchObject({ ok: false, error: "already_answered" });
    expect(dbMove(db, U, B, gid(1), { type: "answer", q: 9, idx: 1 }, "c", t++)).toMatchObject({ ok: false, error: "invalid_move" });
    expect(dbMove(db, U, B, gid(1), { type: "answer", q: 1, idx: 10 }, "d", t++)).toMatchObject({ ok: false, error: "invalid_move" });
  });
  it("whoseTurn: tocca a te finché hai domande aperte", () => {
    const { db, game } = start();
    expect(whoseTurn(game, A)).toBe("mine");
    for (let q = 0; q < 5; q++) {
      const subject = (game.data as QuizData).subjects[q];
      if (subject === A) dbMove(db, U, A, gid(1), { type: "answer", q, idx: 0 }, `a${q}`, t++);
      else dbMove(db, U, A, gid(1), { type: "answer", q, idx: 0 }, `a${q}`, t++);
    }
    expect(whoseTurn(db.games[0], A)).toBe("theirs");
    expect(whoseTurn(db.games[0], B)).toBe("mine");
  });
});

describe("disegna e indovina", () => {
  const start = (db = emptyGamesDb(), who = A) => {
    const r = dbStart(db, U, who, gid(1), "draw", { word: "Gatto", wordId: 12 }, t++);
    if (!r.ok) throw new Error(r.error);
    return db;
  };
  it("chi apre disegna; la parola è segreta e arriva solo a lui", () => {
    const db = start();
    expect((db.games[0].data as DrawData).word).toBeNull();
    expect(JSON.stringify(db.games[0])).not.toContain("Gatto");
    expect(dbSnapshot(db, A).mine[gid(1)]).toEqual({ word: "Gatto" });
    expect(dbSnapshot(db, B).mine).toEqual({});
    expect(db.decks.draw).toEqual([12]);
  });
  it("fasi: disegno (solo il disegnatore) → indovina (solo l'altro)", () => {
    const db = start();
    expect(dbMove(db, U, A, gid(1), { type: "guess", text: "gatto" }, "x1", t++)).toMatchObject({ ok: false, error: "not_your_turn" });
    expect(dbMove(db, U, B, gid(1), { type: "guess", text: "gatto" }, "x2", t++)).toMatchObject({ ok: false, error: "wrong_phase" });
    expect(dbMove(db, U, B, gid(1), { type: "drawing", content: draw() }, "x3", t++)).toMatchObject({ ok: false, error: "not_your_turn" });
    expect(dbMove(db, U, A, gid(1), { type: "drawing", content: { strokes: [] } as never }, "x4", t++)).toMatchObject({ ok: false, error: "invalid_content" });
    expect(dbMove(db, U, A, gid(1), { type: "drawing", content: draw() }, "x5", t++).ok).toBe(true);
    expect(db.games[0].turn).toBe(B);
    expect(dbMove(db, U, A, gid(1), { type: "drawing", content: draw() }, "x6", t++)).toMatchObject({ ok: false, error: "wrong_phase" });
  });
  it("indovina con tolleranza: «i Gatti!» vale; punteggio +1 per entrambi; la parola si rivela", () => {
    const db = start();
    dbMove(db, U, A, gid(1), { type: "drawing", content: draw() }, "d", t++);
    expect(dbMove(db, U, B, gid(1), { type: "guess", text: "cane" }, "g1", t++).ok).toBe(true);
    const r = dbMove(db, U, B, gid(1), { type: "guess", text: " I Gatti! " }, "g2", t++);
    expect(r.ok && r.finished).toBe(true);
    const d = db.games[0].data as DrawData;
    expect(d.phase).toBe("done");
    expect(d.word).toBe("Gatto");
    expect(db.games[0].result).toEqual({ solved: true, attempts: 2, word: "Gatto" });
    expect(db.scores.draw?.[A]?.wins).toBe(1);
  });
  it(`${DRAW_MAX_GUESSES} tentativi sbagliati → si rivela la parola, non risolta`, () => {
    const db = start();
    dbMove(db, U, A, gid(1), { type: "drawing", content: draw() }, "d", t++);
    for (let i = 0; i < 3; i++) dbMove(db, U, B, gid(1), { type: "guess", text: `sbagliata${"a".repeat(i)}` }, `g${i}`, t++);
    expect(db.games[0].status).toBe("done");
    expect(db.games[0].result).toMatchObject({ solved: false, attempts: 3, word: "Gatto" });
    expect(db.scores.draw?.[A]?.wins ?? 0).toBe(0);
    expect(db.scores.draw?.[A]?.played).toBe(1);
  });
  it("chi apre disegna (anche due volte di fila: nessun blocco se l'altro non apre); una sola aperta", () => {
    const db = start();
    dbAbandon(db, U, A, gid(1), t++);
    expect(dbStart(db, U, A, gid(2), "draw", { word: "sole" }, t++).ok).toBe(true);
    expect(dbStart(db, U, B, gid(3), "draw", { word: "luna" }, t++)).toMatchObject({ ok: false, error: "game_open" });
    expect(dbStart(db, U, A, gid(4), "draw", { word: "x" }, t++)).toMatchObject({ ok: false });
  });
  it("abbandona: la partita si chiude, nessun punteggio", () => {
    const db = start();
    const r = dbAbandon(db, U, B, gid(1), t++);
    expect(r.ok && r.game.status).toBe("abandoned");
    expect(db.scores.draw).toBeUndefined();
    expect(dbMove(db, U, A, gid(1), { type: "drawing", content: draw() }, "z", t++)).toMatchObject({ ok: false, error: "game_over" });
  });
});

// ---------- parità con SQL: una lunga passeggiata casuale, registrata in tests/fixtures/games-sequence.json ----------
function walk() {
  let seed = 20261115;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = <X,>(a: X[]) => a[Math.floor(rnd() * a.length)]!;
  const db = emptyGamesDb();
  type Step = { op: "start" | "move" | "abandon"; who: string; game: string; kind?: string; params?: GameParams; move?: GameMove; key: string };
  const steps: Step[] = [];
  const results: unknown[] = [];
  let n = 0;
  let current = "";
  let lastKey = "";
  const words = ["gatto", "Caffè", "stella marina", "il sole", "fiore"];
  const guessList = ["cane", "gatti", "Gatto", "caffe", "STELLA MARINA", "stelle marine", "sole", "i fiori", "", "   ", "x".repeat(41)];
  let prevCurrent = "";
  for (let i = 0; i < 900; i++) {
    let who = pick([A, B]);
    const r = rnd();
    let step: Step;
    const open = db.games.filter((x) => x.status === "open");
    if (open.length && !open.some((x) => x.id === current)) current = pick(open).id;
    else if (open.length > 1 && rnd() < 0.1) current = pick(open).id;
    if (r < 0.14 || !open.length) {
      const free = ["tris", "quiz", "draw"].filter((k) => !open.some((x) => x.kind === k));
      const kind = rnd() < 0.08 || !free.length ? pick(["tris", "quiz", "draw"]) : pick(free);
      prevCurrent = current;
      current = gid(++n);
      const qids = Array.from(new Set(Array.from({ length: 7 }, () => Math.floor(rnd() * 64)))).slice(0, rnd() < 0.75 ? 5 : 4);
      const params: GameParams = kind === "quiz" ? { qids, reset: rnd() < 0.2 } : kind === "draw" ? { word: pick(words), wordId: Math.floor(rnd() * 150) } : {};
      step = { op: "start", who, game: current, kind, params, key: "" };
    } else if (r < 0.17) step = { op: "abandon", who, game: current, key: `ab-${i}` };
    else {
      const g = db.games.find((x) => x.id === current);
      const kind = g?.kind ?? "tris";
      // tre mosse su quattro le fa chi dovrebbe farle (altrimenti la passeggiata finirebbe solo in errori)
      if (g && rnd() < 0.75) {
        if (g.kind === "tris" && g.turn) who = g.turn;
        else if (g.kind === "draw") who = g.status === "open" ? (g.data as DrawData)[(g.data as DrawData).phase === "drawing" ? "drawer" : "guesser"] : who;
      }
      const key = rnd() < 0.05 && lastKey ? lastKey : `mv-${i}-abcdefgh`;
      let move: GameMove;
      if (kind === "tris") move = { type: "place", cell: rnd() < 0.05 ? 11 : Math.floor(rnd() * 9) };
      else if (kind === "quiz") move = { type: "answer", q: rnd() < 0.05 ? 7 : Math.floor(rnd() * 5), idx: rnd() < 0.05 ? 12 : Math.floor(rnd() * 4) };
      else move = rnd() < 0.4 ? { type: "drawing", content: rnd() < 0.15 ? ({ strokes: [{ c: "viola", w: 1, p: [[1, 1]] }] } as never) : draw(1 + Math.floor(rnd() * 5)) } : { type: "guess", text: pick(guessList) };
      const closed = db.games.filter((x) => x.status !== "open" && x.kind === kind);
      step = { op: "move", who, game: rnd() < 0.03 ? gid(999) : rnd() < 0.06 && closed.length ? pick(closed).id : current, move, key };
      lastKey = key;
    }
    steps.push(step);
    t += 7;
    let out: { ok: boolean; error?: string; duplicate?: boolean; game?: unknown };
    if (step.op === "start") {
      const r2 = dbStart(db, U, step.who, step.game, step.kind as never, step.params!, t);
      out = r2.ok ? { ok: true, duplicate: !!r2.duplicate, game: pub(r2.game) } : { ok: false, error: r2.error };
      if (!r2.ok) current = prevCurrent; // la partita non è nata: si continua con quella di prima
    } else if (step.op === "abandon") {
      const r2 = dbAbandon(db, U, step.who, step.game, t);
      out = r2.ok ? { ok: true, game: pub(r2.game) } : { ok: false, error: r2.error };
    } else {
      const r2 = dbMove(db, U, step.who, step.game, step.move!, step.key, t);
      out = r2.ok ? { ok: true, duplicate: !!r2.duplicate, game: pub(r2.game) } : { ok: false, error: r2.error };
    }
    results.push(out);
  }
  return { steps, results, scores: db.scores, decks: db.decks };
}
const pub = (g: GameRow) => ({ kind: g.kind, status: g.status, turn: g.turn, rev: g.rev, data: g.data, result: g.result });

describe("passeggiata casuale (specchio di SQL)", () => {
  const file = path.resolve(__dirname, "fixtures/games-sequence.json");
  const w = walk();
  if (process.env.UPDATE_GAMES_FIXTURE) fs.writeFileSync(file, JSON.stringify(w));
  it("la sequenza registrata coincide con le regole di oggi (rigenera con UPDATE_GAMES_FIXTURE=1)", () => {
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(JSON.parse(JSON.stringify(w)));
  });
  it("copre ogni gioco, ogni esito e gli errori principali", () => {
    const res = w.results as { ok: boolean; error?: string; game?: { kind: string; status: string } }[];
    for (const k of ["tris", "quiz", "draw"]) {
      expect(res.some((r) => r.game?.kind === k && r.game.status === "done"), `${k} finito`).toBe(true);
      expect(res.some((r) => r.game?.kind === k && r.game.status === "abandoned"), `${k} abbandonato`).toBe(true);
    }
    const errs = new Set(res.filter((r) => !r.ok).map((r) => r.error));
    for (const e of ["not_your_turn", "cell_taken", "invalid_move", "already_answered", "wrong_phase", "invalid_content", "game_open", "no_game", "game_over", "invalid_game"])
      expect(errs.has(e), `errore ${e} mai provato`).toBe(true);
    expect(res.some((r) => (r as { duplicate?: boolean }).duplicate)).toBe(true);
  });
});

describe("album dei disegni", () => {
  it("restano gli ultimi ALBUM_MAX disegni finiti, anche se dopo ce n'è uno abbandonato", () => {
    const db = emptyGamesDb();
    const mk = (i: number, status: "done" | "abandoned"): GameRow => ({
      id: gid(100 + i), kind: "draw", status, turn: null, rev: 3,
      data: { drawer: A, guesser: B, phase: "done", drawing: draw(), guesses: [], word: "gatto" },
      result: status === "done" ? { solved: true, attempts: 1, word: "gatto" } : { by: A },
      createdBy: A, createdAt: 1000 + i, updatedAt: 1000 + i, finishedAt: 1000 + i,
    });
    for (let i = 0; i < ALBUM_MAX + 3; i++) db.games.push(mk(i, "done"));
    db.games.push(mk(ALBUM_MAX + 3, "abandoned"));
    const ids = dbSnapshot(db, A).games.map((g) => g.id);
    expect(ids).toContain(gid(100 + ALBUM_MAX + 3)); // l'ultima chiusa
    expect(ids.filter((x) => x !== gid(100 + ALBUM_MAX + 3))).toHaveLength(ALBUM_MAX);
    expect(ids).not.toContain(gid(100)); // la più vecchia è uscita dall'album
  });
});
