import { useEffect, useRef } from "react";

import { useEffectsBus, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import type { GameRow } from "@/lib/games/types";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

/** Id di partite già premiate su questo telefono (in memoria: al peggio una coccola in più, e il pet ha il suo "troppo presto"). */
const rewarded = new Set<string>();

/**
 * Premio comune: quando una partita FINISCE mentre la guardi, il pet riceve una coccola (l'azione che già esiste, con le
 * sue regole e il suo "troppo presto" silenzioso). Niente premio in prova, per le partite lasciate o già finite
 * quando apri la schermata.
 */
export function useGameReward(game: GameRow | null, enabled: boolean) {
  const toast = useToast();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const wasOpen = prev.current === "open";
    prev.current = game?.status ?? null;
    if (!enabled || !game || !wasOpen || game.status !== "done" || rewarded.has(game.id)) return;
    rewarded.add(game.id);
    const r = useCouple.getState().petAct("cuddle");
    if (r.ok) {
      toast.show(S.play.reward);
      useEffectsBus.getState().fireHearts(180, 360);
      haptics.success();
    }
  }, [game, enabled, toast]);
}
