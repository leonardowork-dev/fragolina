import { QUIZ_DECK } from "./quizDeck";
import { QUIZ_LEN } from "./reducer";
import { WORD_DECK } from "./wordDeck";

/**
 * Sceglie fra ciò che NON è ancora uscito (`used` = indici già usciti per questa coppia). Finito il mazzo si ricomincia
 * da capo (`reset: true`): il server azzera la lista e ci mette solo le nuove.
 */
function pickUnused(total: number, used: readonly number[], count: number, rng: () => number): { picked: number[]; reset: boolean } {
  const usedSet = new Set(used);
  let pool = Array.from({ length: total }, (_, i) => i).filter((i) => !usedSet.has(i));
  let reset = false;
  if (pool.length < count) {
    pool = Array.from({ length: total }, (_, i) => i);
    reset = true;
  }
  const picked: number[] = [];
  while (picked.length < count) {
    const k = Math.floor(rng() * pool.length);
    picked.push(pool.splice(k, 1)[0]);
  }
  return { picked, reset };
}

export const pickQuiz = (used: readonly number[], rng: () => number = Math.random) =>
  pickUnused(QUIZ_DECK.length, used, QUIZ_LEN, rng);

export function pickWord(used: readonly number[], rng: () => number = Math.random): { id: number; word: string; reset: boolean } {
  const { picked, reset } = pickUnused(WORD_DECK.length, used, 1, rng);
  return { id: picked[0], word: WORD_DECK[picked[0]], reset };
}
