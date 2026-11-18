import type { GameError } from "./types";

/** Rifiuti "di gioco" del server: la mossa non è valida adesso (turno, casella, fase…). Non si ritentano. */
export const GAME_REJECT_CODES: readonly GameError[] = [
  "game_open",
  "no_game",
  "not_your_turn",
  "game_over",
  "cell_taken",
  "invalid_move",
  "invalid_game",
  "already_answered",
  "wrong_phase",
];
export const isGameReject = (m: string): m is GameError => (GAME_REJECT_CODES as readonly string[]).includes(m);
