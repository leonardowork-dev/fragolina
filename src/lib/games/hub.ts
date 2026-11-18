import { whoseTurn } from "./reducer";
import { GAME_KINDS, type GameKind, type GameRow, type GameScores } from "./types";

/**
 * Cosa mettere in primo piano nella schermata Gioca. Funzioni pure (provate in tests/hub.test.ts).
 * L'elemento dominante è la partita in cui "tocca a te"; poi quella in cui aspetti l'altra persona; se non c'è nulla
 * di aperto, il gioco giocato meno di recente (mai giocato = il più "vecchio").
 */
export type HubEntry = {
  kind: GameKind;
  game: GameRow | null;
  turn: "mine" | "theirs" | "none";
  /** Istante dell'ultima novità (apertura o mossa) della partita aperta, altrimenti dell'ultima chiusa. */
  at: number | null;
};

export function hubEntries(games: readonly GameRow[], me: string): HubEntry[] {
  return GAME_KINDS.map((kind) => {
    const open = games.find((g) => g.kind === kind && g.status === "open") ?? null;
    if (open) return { kind, game: open, turn: whoseTurn(open, me), at: open.updatedAt };
    const closed = [...games].filter((g) => g.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    return { kind, game: null, turn: "none" as const, at: closed ? (closed.finishedAt ?? closed.updatedAt) : null };
  });
}

const rank = (e: HubEntry) => (e.turn === "mine" ? 0 : e.turn === "theirs" ? 1 : 2);

export function hubOrder(games: readonly GameRow[], me: string): { dominant: HubEntry; others: HubEntry[] } {
  const all = hubEntries(games, me);
  const sorted = [...all].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) < 2) return (b.at ?? 0) - (a.at ?? 0); // aperte: la più recente prima
    return (a.at ?? -1) - (b.at ?? -1) || GAME_KINDS.indexOf(a.kind) - GAME_KINDS.indexOf(b.kind); // chiuse: la meno recente prima
  });
  return { dominant: sorted[0], others: sorted.slice(1) };
}

/** La partita in cui tocca a me da più tempo (per l'invito in Home). `null` = niente in sospeso. */
export function pendingTurn(games: readonly GameRow[], me: string): GameRow | null {
  const mine = games.filter((g) => g.status === "open" && whoseTurn(g, me) === "mine");
  return mine.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export type ScoreSummary = {
  tris: { mine: number; theirs: number; draws: number; played: number } | null;
  quiz: { right: number; total: number } | null;
  draw: { solved: number; played: number } | null;
};

/** Il riepilogo dei punteggi della coppia (uno sticker). `null` = quel gioco non è mai stato finito. */
export function scoreSummary(scores: GameScores, me: string, other: string): ScoreSummary {
  const t = scores.tris;
  const trisPlayed = t?.[me]?.played ?? 0;
  const q = scores.quiz?.[me];
  const d = scores.draw?.[me];
  return {
    tris: trisPlayed > 0 ? { mine: t?.[me]?.wins ?? 0, theirs: t?.[other]?.wins ?? 0, draws: t?.[me]?.draws ?? 0, played: trisPlayed } : null,
    quiz: q && q.played > 0 ? { right: q.wins, total: q.played } : null,
    draw: d && d.played > 0 ? { solved: d.wins, played: d.played } : null,
  };
}
