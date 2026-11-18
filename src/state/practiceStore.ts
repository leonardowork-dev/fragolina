import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { BOT_ID, ME_ID, botNext, lastDrawer } from "@/lib/games/bot";
import { pickQuiz, pickWord } from "@/lib/games/decks";
import { type GamesDb, dbAbandon, dbMove, dbSnapshot, dbStart, emptyGamesDb } from "@/lib/games/engine";
import { PRACTICE_WORDS } from "@/lib/games/practiceDrawings";
import type { GameKind, GameMove, GamesSnapshot } from "@/lib/games/types";
import { WORD_DECK } from "@/lib/games/wordDeck";
import { safeStorage } from "@/lib/storage";
import { uuid } from "@/lib/uuid";

/**
 * "Prova con la Fragolina": le STESSE regole dei giochi veri (engine.ts) contro un avversario finto, tutto in locale
 * (nessuna chiamata al server, nessun posto occupato). Persistito: una partita di prova sopravvive alla chiusura
 * dell'app. Le mosse della Fragolina le fa `step()` (la schermata la chiama a intervalli, così si vede "pensa…").
 */
export type PracticeState = {
  hydrated: boolean;
  db: GamesDb;
  start: (kind: GameKind) => { ok: true; id: string } | { ok: false; error: string };
  move: (gameId: string, move: GameMove) => void;
  abandon: (gameId: string) => void;
  /** Una mossa della Fragolina, se tocca a lei. Restituisce true se l'ha fatta. */
  step: (kind: GameKind) => boolean;
  /** C'è una mossa della Fragolina in attesa (per mostrare "pensa…" e programmare `step`). */
  botWaiting: (kind: GameKind) => boolean;
  reset: () => void;
  snapshot: () => GamesSnapshot;
};

export function createPracticeStore(opts: { storage?: StateStorage; name?: string; now?: () => number; rng?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const rng = opts.rng ?? Math.random;
  const users: [string, string] = [ME_ID, BOT_ID];
  return create<PracticeState>()(
    persist(
      (set, get) => ({
        hydrated: false,
        db: emptyGamesDb(),
        start: (kind) => {
          const db: GamesDb = JSON.parse(JSON.stringify(get().db));
          const id = uuid();
          let uid = ME_ID;
          let params = {};
          if (kind === "quiz") {
            const p = pickQuiz(db.decks.quiz ?? [], rng);
            params = { qids: p.picked, reset: p.reset };
          } else if (kind === "draw") {
            // Prima disegna la Fragolina (così vedi come funziona), poi si alterna.
            const prev = lastDrawer(db.games);
            if (prev === null || prev === ME_ID) {
              uid = BOT_ID;
              const word = PRACTICE_WORDS[Math.floor(rng() * PRACTICE_WORDS.length)];
              params = { word, wordId: WORD_DECK.indexOf(word) };
            } else {
              const w = pickWord(db.decks.draw ?? [], rng);
              params = { word: w.word, wordId: w.id, reset: w.reset };
            }
          }
          const r = dbStart(db, users, uid, id, kind, params, now());
          if (!r.ok) return { ok: false, error: r.error };
          set({ db });
          return { ok: true, id };
        },
        move: (gameId, move) => {
          const db: GamesDb = JSON.parse(JSON.stringify(get().db));
          const r = dbMove(db, users, ME_ID, gameId, move, uuid(), now());
          if (r.ok) set({ db });
        },
        abandon: (gameId) => {
          const db: GamesDb = JSON.parse(JSON.stringify(get().db));
          const r = dbAbandon(db, users, ME_ID, gameId, now());
          if (r.ok) set({ db });
        },
        botWaiting: (kind) => botNext(get().db, kind, () => 0.5) !== null,
        step: (kind) => {
          const db: GamesDb = JSON.parse(JSON.stringify(get().db));
          const g = db.games.find((x) => x.kind === kind && x.status === "open");
          const mv = botNext(db, kind, rng);
          if (!g || !mv) return false;
          const r = dbMove(db, users, BOT_ID, g.id, mv, uuid(), now());
          if (!r.ok) return false;
          set({ db });
          return true;
        },
        reset: () => set({ db: emptyGamesDb() }),
        snapshot: () => dbSnapshot(get().db, ME_ID),
      }),
      {
        name: opts.name ?? "fragolina.practice.v1",
        storage: createJSONStorage(() => opts.storage ?? safeStorage),
        partialize: (s) => ({ db: s.db }) as unknown as PracticeState,
        onRehydrateStorage: () => () => {
          store.setState({ hydrated: true });
        },
      },
    ),
  );
}
const store = createPracticeStore();
export const usePractice = store;
