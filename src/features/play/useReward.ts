import { useEffect, useRef } from "react";

import { useEffectsBus, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import { play, type SoundId } from "@/lib/sound";
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

/** Che suono merita una partita appena finita (per chi guarda). `null` = nessuno (sconfitta, partita lasciata). */
export function endSoundFor(game: GameRow, me: string): SoundId | null {
  if (game.status !== "done" || !game.result) return null;
  const r = game.result as { winner?: string | null; score?: number; solved?: boolean };
  if (game.kind === "tris") return r.winner === me ? "fanfara" : r.winner === null ? "pareggio" : null;
  if (game.kind === "quiz") return (r.score ?? 0) >= 4 ? "fanfara" : null;
  return r.solved ? "fanfara" : null;
}

/**
 * Suono di fine partita: solo se finisce MENTRE la guardi (come il premio): mai all'apertura della schermata,
 * una volta sola per partita, mai per partite lasciate.
 */
export function useGameEndSound(game: GameRow | null, me: string) {
  const prev = useRef<string | null>(null);
  const sounded = useRef<string | null>(null);
  useEffect(() => {
    const wasOpen = prev.current === "open";
    prev.current = game?.status ?? null;
    if (!game || !wasOpen || game.status !== "done" || sounded.current === game.id) return;
    sounded.current = game.id;
    const id = endSoundFor(game, me);
    if (id) play(id);
  }, [game, me]);
}
