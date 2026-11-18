import type { GameData, GameDecks, GameKind, GameRow, GameScores, GameSecrets, GameStatus, GamesSnapshot } from "./types";

type J = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ts = (v: unknown): number | null => (typeof v === "string" ? Date.parse(v) : num(v));
const KINDS: GameKind[] = ["tris", "quiz", "draw"];
const STATES: GameStatus[] = ["open", "done", "abandoned"];

function parseObj(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Partita come la manda `_game_json` (camelCase, istanti in millisecondi). */
export function gameFromJson(d: unknown): GameRow | null {
  if (!d || typeof d !== "object") return null;
  const j = d as J;
  if (typeof j.id !== "string" || !KINDS.includes(j.kind as GameKind) || !STATES.includes(j.status as GameStatus)) return null;
  const data = parseObj(j.data);
  if (!data || typeof data !== "object") return null;
  const createdAt = num(j.createdAt);
  if (createdAt === null) return null;
  return {
    id: j.id,
    kind: j.kind as GameKind,
    status: j.status as GameStatus,
    turn: typeof j.turn === "string" ? j.turn : null,
    rev: num(j.rev) ?? 1,
    data: data as GameData,
    result: (parseObj(j.result) as Record<string, unknown> | null) ?? null,
    createdBy: String(j.createdBy ?? ""),
    createdAt,
    updatedAt: num(j.updatedAt) ?? createdAt,
    finishedAt: num(j.finishedAt),
  };
}

/** Riga di `games` nel tempo reale (snake_case, timestamp ISO). */
export function gameFromRecord(r: J): GameRow | null {
  return gameFromJson({
    id: r.id,
    kind: r.kind,
    status: r.status,
    turn: r.turn,
    rev: r.rev,
    data: r.data,
    result: r.result,
    createdBy: r.created_by,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
    finishedAt: ts(r.finished_at),
  });
}

export function gamesSnapshotFromJson(d: J): GamesSnapshot {
  const games = (Array.isArray(d.games) ? d.games : []).map(gameFromJson).filter((g): g is GameRow => g !== null);
  return {
    games,
    scores: ((d.scores as GameScores | undefined) ?? {}) as GameScores,
    decks: ((d.decks as GameDecks | undefined) ?? {}) as GameDecks,
    mine: ((d.mine as Record<string, GameSecrets> | undefined) ?? {}) as Record<string, GameSecrets>,
  };
}
