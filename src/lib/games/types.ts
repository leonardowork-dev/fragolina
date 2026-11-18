import type { NoteDraw } from "@/lib/note/rules";

/**
 * Mini giochi a turni (asincroni). Il server (SQL) e la prova locale (MockServer, pratica) usano le STESSE regole di
 * `reducer.ts`; la parità è provata in tests/games.test.ts e in scripts/sql-check.mjs.
 */
export type GameKind = "tris" | "quiz" | "draw";
export const GAME_KINDS: GameKind[] = ["tris", "quiz", "draw"];
export type GameStatus = "open" | "done" | "abandoned";

/** `board`: 9 caratteri, "X" (fragola, muove per primo), "O" (fiore) o "-" (vuota). */
export type TrisData = { x: string; o: string; board: string; win: number[] | null };
export type QuizReveal = { s: number; g: number; ok: boolean };
export type QuizData = {
  qids: number[];
  /** Chi risponde "su di sé" a ogni domanda (l'altro indovina). */
  subjects: string[];
  /** Solo se c'è già una risposta (mai il valore): serve a "Nikole ha risposto". */
  answered: { s: boolean; g: boolean }[];
  /** Compare solo quando hanno risposto entrambi. */
  reveals: (QuizReveal | null)[];
  score: number;
};
export type DrawGuess = { by: string; text: string; ok: boolean };
export type DrawData = {
  drawer: string;
  guesser: string;
  phase: "drawing" | "guessing" | "done";
  drawing: NoteDraw | null;
  guesses: DrawGuess[];
  /** La parola si scopre solo a fine partita. */
  word: string | null;
};
export type GameData = TrisData | QuizData | DrawData;

export type GameRow = {
  id: string;
  kind: GameKind;
  status: GameStatus;
  /** Di chi è il turno (tris, disegno). `null` = nessuno in particolare (quiz) o finita. */
  turn: string | null;
  rev: number;
  data: GameData;
  result: Record<string, unknown> | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
  /** Ancora in coda sul telefono (non ancora confermata dal server). */
  pending?: boolean;
};

export type GameMove =
  | { type: "place"; cell: number }
  | { type: "answer"; q: number; idx: number }
  | { type: "drawing"; content: NoteDraw }
  | { type: "guess"; text: string };

/** Segreti: per ogni domanda le risposte ("s" = su di sé, "g" = indovinata) e la parola da disegnare. */
export type GameSecrets = { qs?: Record<string, { s?: number; g?: number }>; word?: string };

export type GameParams = { qids?: number[]; reset?: boolean; word?: string; wordId?: number };

export type GameError =
  | "not_paired"
  | "game_open"
  | "no_game"
  | "not_your_turn"
  | "game_over"
  | "cell_taken"
  | "invalid_move"
  | "invalid_game"
  | "already_answered"
  | "wrong_phase"
  | "invalid_content"
  | "invalid_action"
  | "rate_limited";

export type ScoreLine = { wins: number; draws: number; played: number };
/** `scores[kind][userId]` */
export type GameScores = Partial<Record<GameKind, Record<string, ScoreLine>>>;
export type GameDecks = Partial<Record<GameKind, number[]>>;

/** Fotografia dal server (get_games). `mine`: i MIEI segreti per partita. */
export type GamesSnapshot = {
  games: GameRow[];
  scores: GameScores;
  decks: GameDecks;
  mine: Record<string, GameSecrets>;
};
