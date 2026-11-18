import type { GamesDb } from "./engine";
import { QUIZ_DECK } from "./quizDeck";
import { PRACTICE_DRAWINGS } from "./practiceDrawings";
import { QUIZ_LEN, trisWinner } from "./reducer";
import type { DrawData, GameKind, GameMove, GameRow, QuizData, TrisData } from "./types";
import { WORD_DECK } from "./wordDeck";

/**
 * La Fragolina: l'avversaria FINTA della "Prova da solo". Funzioni pure (provate in tests/practice.test.ts): dato lo
 * stato, dicono quale mossa farebbe adesso (o `null`). Non parla con nessun server. Sbaglia apposta ogni tanto.
 */
export const BOT_ID = "fragolina";
export const ME_ID = "tu";
export const TRIS_MISTAKE = 0.28;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
] as const;
const pick = <T,>(xs: readonly T[], rng: () => number): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

/** Casella per `mark`: vince se può, blocca se serve, altrimenti centro/angoli/lati; a volte (`mistake`) a caso. */
export function trisBotMove(board: string, mark: "X" | "O", rng: () => number, mistake = TRIS_MISTAKE): number {
  const empty = [...board].flatMap((c, i) => (c === "-" ? [i] : []));
  if (rng() < mistake) return pick(empty, rng);
  const foe = mark === "X" ? "O" : "X";
  const complete = (m: string) =>
    empty.find((i) => LINES.some((l) => l.includes(i as never) && l.every((j) => (j === i ? m : board[j]) === m)));
  const win = complete(mark);
  if (win !== undefined) return win;
  const block = complete(foe);
  if (block !== undefined) return block;
  if (board[4] === "-") return 4;
  const corners = empty.filter((i) => [0, 2, 6, 8].includes(i));
  if (corners.length) return pick(corners, rng);
  return pick(empty, rng);
}

/** La prossima mossa della Fragolina nella partita aperta di `kind`, o `null` se non tocca a lei. */
export function botNext(db: GamesDb, kind: GameKind, rng: () => number): GameMove | null {
  const g = db.games.find((x) => x.kind === kind && x.status === "open");
  if (!g) return null;
  if (g.kind === "tris") {
    const d = g.data as TrisData;
    if (g.turn !== BOT_ID || trisWinner(d.board)) return null;
    return { type: "place", cell: trisBotMove(d.board, d.x === BOT_ID ? "X" : "O", rng) };
  }
  if (g.kind === "quiz") {
    const d = g.data as QuizData;
    for (let q = 0; q < QUIZ_LEN; q++) {
      const opts = QUIZ_DECK[d.qids[q]]?.options.length ?? 3;
      const subject = d.subjects[q] === BOT_ID;
      const role = subject ? "s" : "g";
      if (d.answered[q][role]) continue;
      // Risponde "su di sé" subito; indovina solo dopo che tu hai risposto su di te.
      if (subject || d.answered[q].s) return { type: "answer", q, idx: Math.floor(rng() * opts) };
    }
    return null;
  }
  const d = g.data as DrawData;
  const word = db.secrets[g.id]?.word ?? "";
  if (d.phase === "drawing" && d.drawer === BOT_ID) {
    const drawing = PRACTICE_DRAWINGS[word];
    return drawing ? { type: "drawing", content: drawing } : null;
  }
  if (d.phase === "guessing" && d.guesser === BOT_ID) {
    // Indovina più spesso a ogni tentativo; se sbaglia, tira fuori un'altra parola del mazzo.
    const odds = [0.34, 0.55, 0.75][d.guesses.length] ?? 0.75;
    if (rng() < odds) return { type: "guess", text: word };
    let wrong = pick(WORD_DECK, rng);
    for (let i = 0; i < 6 && wrong === word; i++) wrong = pick(WORD_DECK, rng);
    return { type: "guess", text: wrong };
  }
  return null;
}

/** Il disegno è del giocatore o della Fragolina? (per sapere chi apre) */
export const lastDrawer = (games: readonly GameRow[]): string | null => {
  // a parità di istante vale l'ultima inserita (reverse + sort stabile)
  const last = [...games].reverse().filter((g) => g.kind === "draw").sort((a, b) => b.createdAt - a.createdAt)[0];
  return last ? (last.data as DrawData).drawer : null;
};
