import { validateContent } from "@/lib/note/rules";

import type {
  DrawData,
  GameError,
  GameKind,
  GameMove,
  GameParams,
  GameRow,
  GameSecrets,
  GameScores,
  QuizData,
  ScoreLine,
  TrisData,
} from "./types";
import { sameWord } from "./words";

/**
 * Le regole dei tre giochi, FUNZIONI PURE. Le usano: il finto server (prova nel browser e test), la prova con la
 * Fragolina (locale) e la vista ottimistica del telefono. Lo specchio SQL è `_game_apply` in
 * supabase/migrations/20261115000001_giochi.sql, confrontato con questo file su centinaia di partite casuali.
 */
export const QUIZ_LEN = 5;
export const DRAW_MAX_GUESSES = 3;
export const GUESS_MAX = 40;
/** Quanti disegni finiti restano nell'album della coppia. */
export const ALBUM_MAX = 12;
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6],
];

export const EMPTY_BOARD = "---------";

export function trisWinner(board: string): { mark: "X" | "O"; line: number[] } | null {
  for (const [a, b, c] of LINES) {
    const m = board[a];
    if (m !== "-" && m === board[b] && m === board[c]) return { mark: m as "X" | "O", line: [a, b, c] };
  }
  return null;
}

export const trisFull = (board: string) => !board.includes("-");

export type Ctx = { uid: string; other: string; now: number };
type Res<T> = ({ ok: true } & T) | { ok: false; error: GameError };
const err = (error: GameError): { ok: false; error: GameError } => ({ ok: false, error });

/** L'ultima partita di quel gioco (per alternare chi inizia). */
export type LastGame = Pick<GameRow, "kind" | "data" | "createdBy"> | null;

/** Crea una partita. Restituisce la riga (senza id/couple) e i segreti iniziali. */
export function startGame(
  kind: GameKind,
  params: GameParams,
  ctx: Ctx,
  last: LastGame,
): Res<{ turn: string | null; data: TrisData | QuizData | DrawData; secrets: GameSecrets }> {
  if (kind === "tris") {
    const lastX = last ? (last.data as TrisData).x : null;
    const x = lastX === null ? ctx.uid : lastX === ctx.uid ? ctx.other : ctx.uid;
    const o = x === ctx.uid ? ctx.other : ctx.uid;
    return { ok: true, turn: x, data: { x, o, board: EMPTY_BOARD, win: null }, secrets: {} };
  }
  if (kind === "quiz") {
    const q = params.qids;
    if (!q || q.length !== QUIZ_LEN || new Set(q).size !== QUIZ_LEN || q.some((n) => !Number.isInteger(n) || n < 0 || n > 999))
      return err("invalid_game");
    const lastFirst = last ? (last.data as QuizData).subjects[0] : null;
    const first = lastFirst === null ? ctx.uid : lastFirst === ctx.uid ? ctx.other : ctx.uid;
    const second = first === ctx.uid ? ctx.other : ctx.uid;
    return {
      ok: true,
      turn: null,
      data: {
        qids: q,
        subjects: [first, second, first, second, first],
        answered: q.map(() => ({ s: false, g: false })),
        reveals: q.map(() => null),
        score: 0,
      },
      secrets: { qs: {} },
    };
  }
  // draw: chi apre la partita è chi disegna (solo lui conosce la parola). Non si impone l'alternanza: se uno dei due
  // non apre mai, l'altro non deve restare bloccato (la scheda suggerisce solo "stavolta tocca a lei").
  const word = (params.word ?? "").trim();
  if (word.length < 2 || [...word].length > GUESS_MAX) return err("invalid_game");
  return {
    ok: true,
    turn: ctx.uid,
    data: { drawer: ctx.uid, guesser: ctx.other, phase: "drawing", drawing: null, guesses: [], word: null },
    secrets: { word },
  };
}

export type MoveOut = {
  game: GameRow;
  secrets: GameSecrets;
  /** Chi ha vinto / com'è finita (solo quando la partita si chiude con questa mossa). */
  finished: boolean;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Applica una mossa. `secrets` = i segreti NOTI A CHI CALCOLA: il server li ha tutti (entrambe le risposte del quiz, la
 * parola); il telefono ha solo i propri e perciò non può rivelare da solo un quiz (resta in attesa del server).
 */
export function applyMove(game: GameRow, move: GameMove, ctx: Ctx, secrets: GameSecrets): Res<MoveOut> {
  if (game.status !== "open") return err("game_over");
  const g = clone(game);
  const sec = clone(secrets);
  g.rev += 1;
  g.updatedAt = ctx.now;

  if (g.kind === "tris" && move.type === "place") {
    const d = g.data as TrisData;
    if (g.turn !== ctx.uid) return err("not_your_turn");
    if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell > 8) return err("invalid_move");
    if (d.board[move.cell] !== "-") return err("cell_taken");
    const mark = ctx.uid === d.x ? "X" : "O";
    d.board = d.board.slice(0, move.cell) + mark + d.board.slice(move.cell + 1);
    const w = trisWinner(d.board);
    if (w) {
      d.win = w.line;
      g.status = "done";
      g.turn = null;
      g.result = { winner: ctx.uid };
      g.finishedAt = ctx.now;
    } else if (trisFull(d.board)) {
      g.status = "done";
      g.turn = null;
      g.result = { winner: null };
      g.finishedAt = ctx.now;
    } else g.turn = ctx.uid === d.x ? d.o : d.x;
    return { ok: true, game: g, secrets: sec, finished: g.status === "done" };
  }

  if (g.kind === "quiz" && move.type === "answer") {
    const d = g.data as QuizData;
    if (!Number.isInteger(move.q) || move.q < 0 || move.q >= QUIZ_LEN) return err("invalid_move");
    if (!Number.isInteger(move.idx) || move.idx < 0 || move.idx > 9) return err("invalid_move");
    const role = d.subjects[move.q] === ctx.uid ? "s" : "g";
    if (d.answered[move.q][role]) return err("already_answered");
    d.answered[move.q][role] = true;
    sec.qs ??= {};
    sec.qs[String(move.q)] = { ...(sec.qs[String(move.q)] ?? {}), [role]: move.idx };
    const both = sec.qs[String(move.q)];
    if (d.answered[move.q].s && d.answered[move.q].g && both.s !== undefined && both.g !== undefined) {
      const ok = both.s === both.g;
      d.reveals[move.q] = { s: both.s, g: both.g, ok };
      if (ok) d.score += 1;
    }
    if (d.reveals.every((r) => r !== null)) {
      g.status = "done";
      g.result = { score: d.score, total: QUIZ_LEN };
      g.finishedAt = ctx.now;
    }
    return { ok: true, game: g, secrets: sec, finished: g.status === "done" };
  }

  if (g.kind === "draw") {
    const d = g.data as DrawData;
    if (move.type === "drawing") {
      if (ctx.uid !== d.drawer) return err("not_your_turn");
      if (d.phase !== "drawing") return err("wrong_phase");
      if (validateContent("draw", move.content) !== null) return err("invalid_content");
      d.drawing = move.content;
      d.phase = "guessing";
      g.turn = d.guesser;
      return { ok: true, game: g, secrets: sec, finished: false };
    }
    if (move.type === "guess") {
      if (ctx.uid !== d.guesser) return err("not_your_turn");
      if (d.phase !== "guessing") return err("wrong_phase");
      const text = move.text.trim();
      if (!text || [...text].length > GUESS_MAX) return err("invalid_move");
      const word = sec.word ?? "";
      const ok = sameWord(text, word);
      d.guesses.push({ by: ctx.uid, text, ok });
      if (ok || d.guesses.length >= DRAW_MAX_GUESSES) {
        d.phase = "done";
        d.word = word;
        g.status = "done";
        g.turn = null;
        g.result = { solved: ok, attempts: d.guesses.length, word };
        g.finishedAt = ctx.now;
      }
      return { ok: true, game: g, secrets: sec, finished: g.status === "done" };
    }
  }
  return err("invalid_move");
}

export function abandonGame(game: GameRow, ctx: Ctx): Res<{ game: GameRow }> {
  if (game.status !== "open") return err("game_over");
  const g = clone(game);
  g.status = "abandoned";
  g.turn = null;
  g.rev += 1;
  g.updatedAt = ctx.now;
  g.finishedAt = ctx.now;
  g.result = { by: ctx.uid };
  return { ok: true, game: g };
}

/** Quanto vale una partita finita per ciascuno: aggiorna "Leonardo 7 – Nikole 9". */
export function scoreDelta(game: GameRow, users: [string, string]): Record<string, ScoreLine> | null {
  if (game.status !== "done") return null;
  const out: Record<string, ScoreLine> = { [users[0]]: { wins: 0, draws: 0, played: 1 }, [users[1]]: { wins: 0, draws: 0, played: 1 } };
  if (game.kind === "tris") {
    const w = (game.result as { winner: string | null }).winner;
    if (w) out[w].wins = 1;
    else for (const u of users) out[u].draws = 1;
  } else if (game.kind === "quiz") {
    const score = (game.result as { score: number }).score;
    for (const u of users) {
      out[u].wins = score;
      out[u].played = QUIZ_LEN;
    }
  } else if ((game.result as { solved: boolean }).solved) for (const u of users) out[u].wins = 1;
  return out;
}

export function addScores(cur: GameScores, kind: GameKind, delta: Record<string, ScoreLine>): GameScores {
  const next: GameScores = { ...cur, [kind]: { ...(cur[kind] ?? {}) } };
  for (const [u, d] of Object.entries(delta)) {
    const c = next[kind]![u] ?? { wins: 0, draws: 0, played: 0 };
    next[kind]![u] = { wins: c.wins + d.wins, draws: c.draws + d.draws, played: c.played + d.played };
  }
  return next;
}

/** Cosa deve fare `me` in questa partita adesso: "mine" = tocca a te, "theirs" = aspetti l'altro, "none" = finita. */
export function whoseTurn(game: GameRow, me: string): "mine" | "theirs" | "none" {
  if (game.status !== "open") return "none";
  if (game.kind === "quiz") {
    const d = game.data as QuizData;
    let myOpen = false;
    let theirOpen = false;
    d.subjects.forEach((s, q) => {
      const roleMe = s === me ? "s" : "g";
      const roleThem = roleMe === "s" ? "g" : "s";
      if (!d.answered[q][roleMe]) myOpen = true;
      if (!d.answered[q][roleThem]) theirOpen = true;
    });
    return myOpen ? "mine" : theirOpen ? "theirs" : "none";
  }
  return game.turn === me ? "mine" : "theirs";
}
