import type { Member, QueuedOp } from "@/lib/sync/types";

import { type Ctx, abandonGame, applyMove, startGame, whoseTurn } from "./reducer";
import type { GameDecks, GameRow, GameScores, GameSecrets, GamesSnapshot, QuizData } from "./types";

/**
 * Le partite come le vede il telefono: ultime notizie del server + operazioni ancora in coda (ottimistiche).
 * Funzioni PURE (come src/lib/note/sync.ts): per annullare una mossa rifiutata basta toglierla dalla coda.
 */
export type GamesSlice = {
  gamesServer: GameRow[];
  gameScores: GameScores;
  gameDecks: GameDecks;
  /** I MIEI segreti per partita (le mie risposte al quiz, la parola che devo disegnare). Mai quelli dell'altra persona. */
  gameMine: Record<string, GameSecrets>;
};
export const emptyGamesSlice = (): GamesSlice => ({ gamesServer: [], gameScores: {}, gameDecks: {}, gameMine: {} });

export type GameQueueOp = Extract<QueuedOp, { kind: "gameStart" | "gameMove" | "gameAbandon" }>;
export const isGameOp = (q: QueuedOp): q is GameQueueOp =>
  q.kind === "gameStart" || q.kind === "gameMove" || q.kind === "gameAbandon";

/** Fotografia completa dal server: è autorevole (sostituisce l'elenco), ma una partita più nuova già nota resta. */
export function mergeSnapshot(cur: GamesSlice, snap: GamesSnapshot): GamesSlice {
  const known = new Map(cur.gamesServer.map((g) => [g.id, g]));
  const games = snap.games.map((g) => {
    const k = known.get(g.id);
    return k && k.rev > g.rev ? k : g;
  });
  return { gamesServer: games, gameScores: snap.scores, gameDecks: snap.decks, gameMine: snap.mine };
}

/** Una singola partita arrivata dal tempo reale o da una risposta: vince la revisione più alta. */
export function mergeGame(cur: GamesSlice, g: GameRow): { slice: GamesSlice; changed: boolean; prev: GameRow | null } {
  const prev = cur.gamesServer.find((x) => x.id === g.id) ?? null;
  if (prev && prev.rev >= g.rev) return { slice: cur, changed: false, prev };
  const rest = cur.gamesServer.filter((x) => x.id !== g.id);
  const games = [g, ...rest].sort((a, b) => b.createdAt - a.createdAt);
  return { slice: { ...cur, gamesServer: games }, changed: true, prev };
}

export type GamesView = { games: GameRow[]; mine: Record<string, GameSecrets> };

/** Le partite da mostrare: server + coda. Una mossa che non sta in piedi (già fatta, fuori turno…) si salta. */
export function replayGames(
  slice: GamesSlice,
  queue: readonly QueuedOp[],
  me: string | null,
  other: string | null,
): GamesView {
  let games = slice.gamesServer.map((g) => g);
  const mine: Record<string, GameSecrets> = { ...slice.gameMine };
  if (!me || !other) return { games, mine };
  for (const q of queue) {
    if (!isGameOp(q)) continue;
    const ctx: Ctx = { uid: me, other, now: q.at };
    if (q.kind === "gameStart") {
      if (games.some((g) => g.id === q.id) || games.some((g) => g.kind === q.game && g.status === "open")) continue;
      const last = [...games].reverse().filter((g) => g.kind === q.game).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
      const r = startGame(q.game, q.params, ctx, last);
      if (!r.ok) continue;
      games = [
        {
          id: q.id, kind: q.game, status: "open", turn: r.turn, rev: 1, data: r.data, result: null,
          createdBy: me, createdAt: q.at, updatedAt: q.at, finishedAt: null, pending: true,
        },
        ...games,
      ];
      mine[q.id] = r.secrets;
    } else if (q.kind === "gameMove") {
      const i = games.findIndex((g) => g.id === q.gameId);
      if (i < 0) continue;
      // Il verdetto di un tentativo lo dà SOLO il server (la parola è un suo segreto): qui lo segno "in attesa".
      if (q.move.type === "guess") {
        games = games.map((g, j) => (j === i ? { ...g, pending: true } : g));
        continue;
      }
      const r = applyMove(games[i], q.move, ctx, mine[q.gameId] ?? {});
      if (!r.ok) continue;
      games = games.map((g, j) => (j === i ? { ...r.game, pending: true } : g));
      mine[q.gameId] = r.secrets;
    } else {
      const i = games.findIndex((g) => g.id === q.gameId);
      if (i < 0) continue;
      const r = abandonGame(games[i], ctx);
      if (r.ok) games = games.map((g, j) => (j === i ? { ...r.game, pending: true } : g));
    }
  }
  return { games, mine };
}

/** Di chi è il turno nella partita (con la fotografia ottimistica). */
export { whoseTurn };

export type GameChange =
  | { type: "started" }
  | { type: "your-turn" }
  | { type: "answered" }
  | { type: "reveal" }
  | { type: "done" }
  | { type: "abandoned" };

/**
 * Che cosa è cambiato per `me` fra due versioni della stessa partita (per il toast in tempo reale). `null` = niente da
 * dire (es. una mia mossa, o la stessa versione).
 */
export function describeChange(prev: GameRow | null, next: GameRow, me: string): GameChange | null {
  if (prev && next.rev <= prev.rev) return null;
  if (next.status === "abandoned") return prev?.status === "open" || !prev ? { type: "abandoned" } : null;
  if (next.status === "done") {
    if (prev && prev.status !== "open") return null;
    return { type: "done" };
  }
  if (!prev) return next.createdBy !== me ? { type: "started" } : null;
  if (next.kind === "quiz") {
    const a = prev.data as QuizData;
    const b = next.data as QuizData;
    const newReveal = b.reveals.some((r, i) => r && !a.reveals[i]);
    if (newReveal) return { type: "reveal" };
    const theirNew = b.answered.some((x, i) => {
      const theirRole = b.subjects[i] === me ? "g" : "s";
      return x[theirRole] && !a.answered[i][theirRole];
    });
    return theirNew ? { type: "answered" } : null;
  }
  if (whoseTurn(next, me) === "mine" && whoseTurn(prev, me) !== "mine") return { type: "your-turn" };
  return null;
}

export const otherOf = (members: readonly Member[], me: string | null): string | null =>
  members.find((m) => m.userId !== me)?.userId ?? null;
