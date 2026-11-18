import { useEffect, useMemo } from "react";

import { BOT_ID, ME_ID } from "@/lib/games/bot";
import { type GamesDb, dbSnapshot } from "@/lib/games/engine";
import { otherOf, replayGames } from "@/lib/games/sync";
import type { GameKind, GameMove, GameRow, GameScores, GameSecrets } from "@/lib/games/types";
import { S } from "@/lib/strings.it";
import { selectPairing, useCouple } from "@/state/coupleStore";
import { usePractice } from "@/state/practiceStore";

/**
 * Da dove arrivano le partite: dal server (coppia vera) o dalla prova locale con la Fragolina. Le schermate dei
 * giochi non sanno quale delle due stanno usando: leggono sempre una `GamesSource`.
 */
export type GamesSource = {
  mode: "couple" | "practice";
  /** Dati pronti (la coppia ha caricato almeno una volta le partite). */
  ready: boolean;
  me: string;
  other: string;
  meName: string;
  partnerName: string;
  games: GameRow[];
  mine: Record<string, GameSecrets>;
  scores: GameScores;
  offline: boolean;
  start: (kind: GameKind) => { ok: true; id: string } | { ok: false; error: string };
  move: (gameId: string, move: GameMove) => void;
  abandon: (gameId: string) => void;
  /** La Fragolina sta per muovere (solo prova). */
  botThinking: (kind: GameKind) => boolean;
};

const EMPTY_DB: GamesDb = { games: [], secrets: {}, scores: {}, decks: {}, keys: {} };

export function useGamesSource(mode: "couple" | "practice"): GamesSource {
  const userId = useCouple((s) => s.userId);
  const members = useCouple((s) => s.members);
  const meName = useCouple((s) => s.meName);
  const partnerName = useCouple((s) => s.partnerName);
  const queue = useCouple((s) => s.queue);
  const gamesServer = useCouple((s) => s.gamesServer);
  const gameScores = useCouple((s) => s.gameScores);
  const gameMine = useCouple((s) => s.gameMine);
  const available = useCouple((s) => s.gamesAvailable);
  const link = useCouple((s) => s.link);
  const pairing = useCouple(selectPairing);
  const startGame = useCouple((s) => s.startGame);
  const gameMove = useCouple((s) => s.gameMove);
  const abandonGame = useCouple((s) => s.abandonGame);

  const db = usePractice((s) => s.db ?? EMPTY_DB);
  const practiceStart = usePractice((s) => s.start);
  const practiceMove = usePractice((s) => s.move);
  const practiceAbandon = usePractice((s) => s.abandon);
  const botWaiting = usePractice((s) => s.botWaiting);

  const other = otherOf(members, userId);
  const couple = useMemo(
    () => replayGames({ gamesServer, gameScores, gameDecks: {}, gameMine }, queue, userId, other),
    [gamesServer, gameScores, gameMine, queue, userId, other],
  );
  const practice = useMemo(() => dbSnapshot(db, ME_ID), [db]);

  if (mode === "practice")
    return {
      mode,
      ready: true,
      me: ME_ID,
      other: BOT_ID,
      meName,
      partnerName: S.play.practice.name,
      games: practice.games,
      mine: practice.mine,
      scores: practice.scores,
      offline: false,
      start: practiceStart,
      move: practiceMove,
      abandon: practiceAbandon,
      botThinking: (k) => botWaiting(k),
    };
  return {
    mode,
    ready: available === true && pairing === "paired",
    me: userId ?? "",
    other: other ?? "",
    meName,
    partnerName,
    games: couple.games,
    mine: couple.mine,
    scores: gameScores,
    offline: link === "offline",
    start: startGame,
    move: gameMove,
    abandon: abandonGame,
    botThinking: () => false,
  };
}

/** La Fragolina muove con un po' di calma (si vede "pensa…"). Montare dove si gioca in prova. */
export function usePracticeBot(active: boolean) {
  const db = usePractice((s) => s.db);
  useEffect(() => {
    if (!active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const kind of ["tris", "quiz", "draw"] as const) {
      if (!usePractice.getState().botWaiting(kind)) continue;
      const delay = kind === "draw" ? 1800 : kind === "quiz" ? 900 : 1000;
      timers.push(setTimeout(() => void usePractice.getState().step(kind), delay));
    }
    return () => timers.forEach(clearTimeout);
  }, [active, db]);
}

export const openGameOf = (games: readonly GameRow[], kind: GameKind): GameRow | null =>
  games.find((g) => g.kind === kind && g.status === "open") ?? null;

/** Ultima partita finita o lasciata di quel gioco (per mostrare l'esito e offrire la rivincita). */
export const lastClosedOf = (games: readonly GameRow[], kind: GameKind): GameRow | null =>
  [...games].filter((g) => g.kind === kind && g.status !== "open").sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
