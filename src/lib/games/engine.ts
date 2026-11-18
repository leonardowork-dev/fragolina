import {
  ALBUM_MAX,
  abandonGame,
  addScores,
  applyMove,
  scoreDelta,
  startGame,
} from "./reducer";
import type {
  GameDecks,
  GameError,
  GameKind,
  GameMove,
  GameParams,
  GameRow,
  GameScores,
  GameSecrets,
  GamesSnapshot,
} from "./types";

/**
 * Il "server dei giochi" in TypeScript puro, per UNA coppia: lo usa il finto server (prova nel browser, test) e la
 * prova di parità con SQL. Fa ciò che fanno `start_game`, `game_move`, `abandon_game` e `get_games` nella migrazione 7:
 * una sola partita aperta per gioco, mosse idempotenti per chiave, segreti che non escono, punteggi, mazzi.
 */
export type GamesDb = {
  games: GameRow[];
  secrets: Record<string, GameSecrets>;
  scores: GameScores;
  decks: GameDecks;
  /** `"utente:chiave"` → id della partita (idempotenza). */
  keys: Record<string, string>;
};
export const emptyGamesDb = (): GamesDb => ({ games: [], secrets: {}, scores: {}, decks: {}, keys: {} });

export type Out<T> = ({ ok: true } & T) | { ok: false; error: GameError; game?: GameRow };
type Users = [string, string];
const otherOf = (u: Users, uid: string) => (u[0] === uid ? u[1] : u[0]);

export function dbStart(
  db: GamesDb,
  users: Users,
  uid: string,
  id: string,
  kind: GameKind,
  params: GameParams,
  now: number,
): Out<{ game: GameRow; duplicate?: boolean }> {
  const dup = db.games.find((g) => g.id === id);
  if (dup) return { ok: true, duplicate: true, game: dup };
  const open = db.games.find((g) => g.kind === kind && g.status === "open");
  if (open) return { ok: false, error: "game_open", game: open };
  // a parità di istante vale l'ultima inserita (reverse + sort stabile)
  const last = [...db.games].reverse().filter((g) => g.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  const r = startGame(kind, params, { uid, other: otherOf(users, uid), now }, last);
  if (!r.ok) return r;
  const game: GameRow = {
    id,
    kind,
    status: "open",
    turn: r.turn,
    rev: 1,
    data: r.data,
    result: null,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
  db.games.push(game);
  db.secrets[id] = r.secrets;
  if (kind === "quiz" && params.qids) {
    const prev = params.reset ? [] : (db.decks.quiz ?? []);
    db.decks.quiz = [...new Set([...prev, ...params.qids])].sort((a, b) => a - b);
  }
  if (kind === "draw" && typeof params.wordId === "number") {
    const prev = params.reset ? [] : (db.decks.draw ?? []);
    db.decks.draw = [...new Set([...prev, params.wordId])].sort((a, b) => a - b);
  }
  return { ok: true, game };
}

export function dbMove(
  db: GamesDb,
  users: Users,
  uid: string,
  gameId: string,
  move: GameMove,
  key: string,
  now: number,
): Out<{ game: GameRow; finished: boolean; duplicate?: boolean }> {
  const dupId = db.keys[`${uid}:${key}`];
  if (dupId) {
    const g = db.games.find((x) => x.id === dupId)!;
    return { ok: true, duplicate: true, game: g, finished: g.status === "done" };
  }
  const idx = db.games.findIndex((g) => g.id === gameId);
  if (idx < 0) return { ok: false, error: "no_game" };
  const r = applyMove(db.games[idx], move, { uid, other: otherOf(users, uid), now }, db.secrets[gameId] ?? {});
  if (!r.ok) return r;
  db.games[idx] = r.game;
  db.secrets[gameId] = r.secrets;
  db.keys[`${uid}:${key}`] = gameId;
  if (r.finished) {
    const delta = scoreDelta(r.game, users);
    if (delta) db.scores = addScores(db.scores, r.game.kind, delta);
  }
  return { ok: true, game: r.game, finished: r.finished };
}

export function dbAbandon(db: GamesDb, users: Users, uid: string, gameId: string, now: number): Out<{ game: GameRow }> {
  const idx = db.games.findIndex((g) => g.id === gameId);
  if (idx < 0) return { ok: false, error: "no_game" };
  if (db.games[idx].status !== "open") return { ok: true, game: db.games[idx] };
  const r = abandonGame(db.games[idx], { uid, other: otherOf(users, uid), now });
  if (!r.ok) return r;
  db.games[idx] = r.game;
  return { ok: true, game: r.game };
}

/** Ciò che vede `uid`: partite aperte + l'ultima chiusa di ogni gioco, punteggi, mazzi e SOLO i propri segreti. */
export function dbSnapshot(db: GamesDb, uid: string): GamesSnapshot {
  const lastClosed = new Map<GameKind, GameRow>();
  for (const g of [...db.games].sort((a, b) => b.createdAt - a.createdAt))
    if (g.status !== "open" && !lastClosed.has(g.kind)) lastClosed.set(g.kind, g);
  // L'album: gli ultimi ALBUM_MAX disegni finiti restano visibili (specchio di get_games).
  const album = new Set(
    db.games
      .filter((g) => g.kind === "draw" && g.status === "done")
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, ALBUM_MAX)
      .map((g) => g.id),
  );
  const shown = db.games
    .filter((g) => g.status === "open" || lastClosed.get(g.kind)?.id === g.id || album.has(g.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  const mine: GamesSnapshot["mine"] = {};
  for (const g of shown) {
    const s = db.secrets[g.id];
    if (!s) continue;
    if (g.kind === "quiz") {
      const subjects = (g.data as { subjects: string[] }).subjects;
      const qs: NonNullable<GameSecrets["qs"]> = {};
      for (const [q, v] of Object.entries(s.qs ?? {})) {
        const role = subjects[Number(q)] === uid ? "s" : "g";
        if (v[role] !== undefined) qs[q] = { [role]: v[role] };
      }
      if (Object.keys(qs).length) mine[g.id] = { qs };
    } else if (g.kind === "draw" && (g.data as { drawer: string }).drawer === uid && s.word) mine[g.id] = { word: s.word };
  }
  return { games: shown, scores: db.scores, decks: db.decks, mine };
}
