import { useMemo } from "react";

import { pendingTurn } from "@/lib/games/hub";
import { otherOf, replayGames } from "@/lib/games/sync";
import type { GameRow } from "@/lib/games/types";
import { useCouple } from "@/state/coupleStore";

/** La partita in cui tocca a me (la più recente), per l'invito in Home. `null` = niente in sospeso (nessun rumore). */
export function usePendingGame(): GameRow | null {
  const userId = useCouple((s) => s.userId);
  const members = useCouple((s) => s.members);
  const queue = useCouple((s) => s.queue);
  const gamesServer = useCouple((s) => s.gamesServer);
  const gameMine = useCouple((s) => s.gameMine);
  return useMemo(() => {
    if (!userId || members.length < 2) return null;
    const view = replayGames({ gamesServer, gameScores: {}, gameDecks: {}, gameMine }, queue, userId, otherOf(members, userId));
    return pendingTurn(view.games, userId);
  }, [userId, members, queue, gamesServer, gameMine]);
}
