import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { ME_NAME, PARTNER_NAME } from "@/config/couple";
import type { MoodId } from "@/features/home/moods";
import type { Backend } from "@/lib/backend/types";
import {
  type FoodId,
  type PetKind,
  type PetState,
  cleanPetName,
  cooldownLeft,
} from "@/lib/pet/rules";
import {
  type PetSlice,
  emptyPetSlice,
  isPetOp,
  mergePetEvent,
  mergePetSnapshot,
  myLastAt,
  replayPet,
} from "@/lib/pet/sync";
import { safeStorage } from "@/lib/storage";
import { S } from "@/lib/strings.it";
import { backoffDelay } from "@/lib/sync/backoff";
import { COUPLE_VERSION, migrateCouple } from "./migrateCouple";
import { useNet } from "./netStore";
import { enqueue, flushQueue } from "@/lib/sync/queue";
import {
  type SyncedState,
  applyEvent,
  applySnapshot,
  questionIdForDay,
  rollbackOp,
  rolloverDay,
} from "@/lib/sync/reducer";
import {
  BackendError,
  type BackendErrorKind,
  type DailyAnswer,
  type LinkStatus,
  type QueuedOp,
  type RemoteInput,
} from "@/lib/sync/types";
import { pickQuiz, pickWord } from "@/lib/games/decks";
import type { GameError, GameKind, GameMove, GameParams, GameRow } from "@/lib/games/types";
import {
  type GameChange,
  type GamesSlice,
  describeChange,
  emptyGamesSlice,
  isGameOp,
  mergeGame,
  mergeSnapshot,
  otherOf,
  replayGames,
} from "@/lib/games/sync";
import { type LocationState, emptyLocation } from "@/lib/geo/types";
import { type Note, type NoteContent, type NoteKind, noteState } from "@/lib/note/rules";
import {
  type NoteSlice,
  emptyNoteSlice,
  isLocalNoteId,
  mergeNote,
  noteFromRow,
  replayNote,
} from "@/lib/note/sync";
import { type CountdownEvent, type EventInput, cleanTitle, validateEvent as validateEventInput } from "@/lib/countdown/rules";
import { type EventsSlice, emptyEventsSlice } from "@/lib/countdown/sync";
import { discardPhoto } from "@/lib/memories/photoDevice";
import { type MemoriesSlice, emptyMemoriesSlice, replayMemories } from "@/lib/memories/sync";
import { type Memory, cleanCaption } from "@/lib/memories/types";
import { type MonthRaw } from "@/lib/memories/month";
import { type QaDay, type QaSnapshot, cleanAnswer, cleanQuestion, questionRefForDay } from "@/lib/qa/rules";
import { type QaSlice, emptyQaSlice, mergeQaDay } from "@/lib/qa/sync";
import { localDayKey, localDayStartMs, romeDayKey } from "@/lib/time";
import { uuid } from "@/lib/uuid";

/**
 * Store della coppia + motore di sincronizzazione.
 * Tutto passa da `Backend` (Supabase o prova locale: l'interfaccia grafica non lo sa). Le scritture sono ottimistiche
 * (si vedono subito), finiscono in una coda persistita con chiavi di idempotenza e vengono spedite in ordine appena
 * c'è rete; se il server le rifiuta si annullano (rollback). Tutto ciò che arriva dal server entra da `applyRemote`.
 */
export const QUESTION_IDS = S.questions.map((q) => q.id);

export type ActionResult = { ok: true } | { ok: false; error: BackendErrorKind };
export type PetActResult =
  | { ok: true }
  | { ok: false; error: "cooldown"; waitMs: number }
  | { ok: false; error: "not_paired" | "not_hatched" };

/** Ultima cura fatta dall'ALTRA persona (per il toast in tempo reale). */
export type PetIncoming = { by: string; kind: PetKind | "hatch" | "name"; item: FoodId | null; at: number };

/** Un biglietto arrivato dall'altra persona in tempo reale (toast + aptica). */
export type NoteIncoming = { byName: string; kind: NoteKind; at: number };

/** Una novità dei giochi portata dall'altra persona in tempo reale (toast + aptica). */
export type GameIncoming = { kind: GameKind; change: GameChange; at: number };
/** Una mia mossa che il server ha rifiutato (turno cambiato nel frattempo, casella presa…): messaggio gentile. */
export type GameRejection = { kind: GameKind | null; error: GameError };

/** Una novità portata dall'altra persona (sessione 7). */
export type ExtraIncoming =
  | { what: "qa-answered" | "qa-ready" }
  | { what: "event"; title: string }
  | { what: "memory"; kind: Memory["kind"] };

type Ephemeral = {
  hydrated: boolean;
  backendKind: "supabase" | "mock";
  link: LinkStatus;
  /** Sale a ogni "penso a te" ricevuto in tempo reale (l'interfaccia mostra toast e cuori). */
  incomingSeq: number;
  /** Sale quando B entra mentre A aspetta (momento di festa lato A). */
  pairedSeq: number;
  /** Sale quando il server rifiuta in modo definitivo un'operazione (annullata). */
  rejectedSeq: number;
  busy: boolean;
  /** null = non lo so ancora; false = il server non ha la migrazione del pet (MANUAL_TODO, sessione 4). */
  petAvailable: boolean | null;
  /** Sale quando l'altra persona cura il pet in tempo reale (toast + animazione). */
  petIncomingSeq: number;
  petIncoming: PetIncoming | null;
  /** null = non lo so ancora; false = il server non ha la migrazione dei biglietti (MANUAL_TODO, sessione 5). */
  noteAvailable: boolean | null;
  noteIncomingSeq: number;
  noteIncoming: NoteIncoming | null;
  /** null = non lo so ancora; false = il server non ha la migrazione dei giochi (MANUAL_TODO, sessione 6). */
  gamesAvailable: boolean | null;
  gameIncomingSeq: number;
  gameIncoming: GameIncoming | null;
  gameRejectedSeq: number;
  gameRejected: GameRejection | null;
  /** null = non lo so ancora; false = il server non ha la migrazione della sessione 7 (eventi, domanda vera, ricordi). */
  extraAvailable: boolean | null;
  /** Dopo la prima lettura: da qui in poi un evento/ricordo nuovo dell'altro persona è una "novità" da annunciare (non lo stato iniziale). */
  eventsAvailableSeen: boolean;
  memoriesSeen: boolean;
  /** Novità dell'altra persona in tempo reale (toast): domanda risposta/rivelata, evento nuovo, foto nuova. */
  extraIncomingSeq: number;
  extraIncoming: ExtraIncoming | null;
  /** Tocchi all'uovo non ancora messi in coda (si raggruppano per mezzo secondo). */
  pendingTouches: number;
  pendingTouchAt: number;
};

type Engine = {
  start: () => void;
  stop: () => void;
  setForeground: (a: boolean) => void;
  /** La rete è tornata (lo dice il sistema): riconnette subito e svuota la coda, senza aspettare il backoff. */
  networkBack: () => void;
  resync: () => Promise<void>;
  flush: () => Promise<void>;
};

export type CoupleState = SyncedState &
  EventsSlice &
  QaSlice &
  MemoriesSlice &
  PetSlice &
  NoteSlice &
  GamesSlice &
  Ephemeral & {
    queue: QueuedOp[];
    /** Posizioni (arrotondate) e interruttore "Condividi la distanza". */
    loc: LocationState;
    /** Token con cui il widget legge il feed (solo su questo telefono e nel container del widget). */
    widgetToken: string | null;
    /** Manda un biglietto (disegno o scritta). Subito visibile; parte in coda. */
    sendNote: (kind: NoteKind, content: NoteContent) => { ok: true } | { ok: false; error: "not_paired" };
    /** Pulisce il biglietto di adesso, per entrambi. */
    clearNote: () => void;
    /** Apre una partita (id deciso qui, quindi idempotente). Subito visibile; parte in coda. */
    startGame: (kind: GameKind) => { ok: true; id: string } | { ok: false; error: "not_paired" | "game_open" };
    /** Una mossa. Subito visibile; il server la valida e, se non va più bene, torna indietro con un messaggio gentile. */
    gameMove: (gameId: string, move: GameMove) => void;
    abandonGame: (gameId: string) => void;
    /** Rilegge le partite dal server (silenziosa). */
    refreshGames: () => Promise<void>;
    /** Conto alla rovescia: crea (id null) o modifica un evento. Subito visibile; parte in coda. */
    saveEvent: (id: string | null, input: EventInput) => { ok: true; id: string } | { ok: false; error: "not_paired" | "title" | "date" | "time" | "icon" };
    removeEvent: (id: string) => void;
    /** La mia risposta alla domanda di oggi (una al giorno). */
    qaAnswer: (text: string) => { ok: true } | { ok: false; error: "not_paired" | "empty" | "done" };
    /** La domanda di domani, scritta da me (solo se tocca a me: il server lo controlla). */
    qaTomorrow: (text: string) => { ok: true } | { ok: false; error: "not_paired" | "short" };
    /** Aggiunge una foto già ridotta (file locale). Si vede subito; il caricamento parte in coda. */
    addPhoto: (p: { uri: string; w: number; h: number; bytes: number }, caption: string, day: string) => { ok: true; id: string } | { ok: false; error: "not_paired" };
    /** Tiene un biglietto o un disegno nei ricordi. `id` = id del biglietto/della partita (tenerlo due volte non lo duplica). */
    keepMemory: (a: { id: string; kind: "draw" | "text"; source: "note" | "game"; caption: string; content: NonNullable<Memory["content"]>; day?: string }) => { ok: true } | { ok: false; error: "not_paired" };
    deleteMemory: (id: string) => void;
    /** Rilegge eventi, domanda e ricordi dal server (silenziosa). */
    refreshExtra: () => Promise<void>;
    /** URL firmati (10 minuti) per le foto. */
    signMemoryUrls: (paths: string[]) => Promise<Record<string, string>>;
    /** "Il nostro mese" (non si salva: si legge quando apri la pagina). `null` = migrazione mancante. */
    fetchMonth: (year: number, month: number) => Promise<MonthRaw | null>;
    setLocationSharing: (on: boolean) => Promise<ActionResult>;
    /** Posizione già arrotondata. Silenziosa: se non va, riprova al prossimo aggiornamento. */
    shareLocation: (p: { latE2: number; lonE2: number }) => Promise<ActionResult>;
    lastSyncAt: number | null;
    /** La sessione anonima è stata sostituita (app reinstallata, portachiavi perso): la coppia va ricollegata. */
    sessionLost: boolean;
    setMyName: (name: string) => void;
    setStartDate: (iso: string) => void;
    setMyMood: (mood: MoodId) => void;
    sendThought: () => boolean;
    answerQuestion: (a: DailyAnswer) => void;
    /** Una cura al pet (nutri, coccola, gioca, nanna). Subito visibile; parte in coda. */
    petAct: (kind: Exclude<PetKind, "touch">, item?: FoodId) => PetActResult;
    /** Un tocco all'uovo. */
    touchEgg: () => void;
    setPetName: (name: string) => void;
    applyRemote: (input: RemoteInput) => void;
    createCouple: () => Promise<ActionResult>;
    joinCouple: (code: string) => Promise<ActionResult>;
    renewCode: () => Promise<ActionResult>;
    leaveCouple: () => Promise<ActionResult>;
    releasePartner: () => Promise<ActionResult>;
    dismissSessionLost: () => void;
    /** Il nome di lei, solo finché non siete collegati (poi lo decide lei). */
    setPartnerNameLocal: (name: string) => void;
    /** Giorno per cui hai già scoperto la risposta del partner. */
    revealedDay: string | null;
    markRevealed: () => void;
    /** Giorno (di Roma) in cui hai già girato la carta con le due risposte della domanda vera. */
    qaRevealedDay: string | null;
    markQaRevealed: (day: string) => void;
    /** Motore di sincronizzazione (usare `syncEngine`). */
    __engine: Engine;
  };

export type CoupleDeps = {
  backend: Backend;
  storage?: StateStorage;
  storageName?: string;
  now?: () => number;
  rng?: () => number;
};

/** Fette della sessione 7 (eventi, domanda vera, ricordi): vuote quando si cambia o si lascia la coppia. */
const emptyExtraSlice = () => ({ ...emptyEventsSlice(), ...emptyQaSlice(), ...emptyMemoriesSlice(), extraAvailable: null as boolean | null });

const initialSynced = (day: string): SyncedState => ({
  userId: null,
  coupleId: null,
  myRole: null,
  joinCode: null,
  joinCodeExpiresAt: null,
  members: [],
  meName: ME_NAME,
  partnerName: PARTNER_NAME,
  startDate: null,
  startDateAt: 0,
  myMood: null,
  partnerMood: null,
  pingsDay: day,
  pingsSentToday: 0,
  pingsReceivedTotal: 0,
  lastPingReceivedAt: null,
  lastPingSentAt: null,
  question: { day, id: QUESTION_IDS[0], myAnswer: null, partnerAnswer: null },
});

const SYNC_KEYS = Object.keys(initialSynced("x")) as (keyof SyncedState)[];
const pickSynced = (s: SyncedState): SyncedState =>
  Object.fromEntries(SYNC_KEYS.map((k) => [k, s[k]])) as unknown as SyncedState;

export function createCoupleStore(deps: CoupleDeps) {
  const { backend } = deps;
  const now = deps.now ?? Date.now;
  const rng = deps.rng ?? Math.random;
  const today = () => localDayKey(new Date(now()));

  const useCouple = create<CoupleState>()(
    persist(
      (set, get) => {
        const synced = () => pickSynced(get());

        // ---------- motore ----------
        let started = false;
        let foreground = true;
        let unsub: (() => void) | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;
        let attempt = 0;
        let flushing: Promise<void> | null = null;
        let resyncing: Promise<void> | null = null;
        const seenPings = new Set<string>();
        // Mutex "io" (KNOWN_ISSUES 42, causa di fondo): una lettura dello stato e la spedizione della coda non si
        // sovrappongono mai. Altrimenti la lettura poteva arrivare DOPO l'inserimento di un pensiero sul server ma PRIMA
        // che l'operazione uscisse dalla coda: il conteggio (server + coda) lo contava due volte.
        let ioChain: Promise<unknown> = Promise.resolve();
        const io = <T,>(fn: () => Promise<T>): Promise<T> => {
          const run = ioChain.then(fn, fn);
          ioChain = run.then(
            () => undefined,
            () => undefined,
          );
          return run;
        };

        const clearTimers = () => {
          if (retryTimer) clearTimeout(retryTimer);
          if (pollTimer) clearTimeout(pollTimer);
          retryTimer = pollTimer = null;
        };
        const teardown = () => {
          unsub?.();
          unsub = null;
        };
        const goOffline = () => {
          useNet.getState().noteFailure();
          set({ link: "offline" });
          teardown();
          if (!started || !foreground) return;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(
            () => {
              retryTimer = null;
              void connect();
            },
            backoffDelay(attempt++, rng),
          );
        };

        const petSlice = (): PetSlice => ({
          petServer: get().petServer,
          petLog: get().petLog,
          petMyLast: get().petMyLast,
        });
        const ingestPetEvent = (pet: PetState) => {
          const { slice, fresh, entry } = mergePetEvent(petSlice(), pet);
          if (!fresh) return;
          const cur = get();
          const theirs = !!entry && entry.userId !== cur.userId && entry.kind !== "touch";
          set({
            ...slice,
            petAvailable: true,
            lastSyncAt: now(),
            ...(theirs && entry
              ? {
                  petIncomingSeq: cur.petIncomingSeq + 1,
                  petIncoming: { by: entry.userId, kind: entry.kind, item: entry.item, at: entry.at },
                }
              : null),
          });
        };

        const ingestNote = (n: Note | null, live: boolean) => {
          const cur = get();
          const merged = mergeNote(cur.noteServer, n);
          if (merged === cur.noteServer) return;
          const fresh = !!n && merged === n && n.id !== cur.noteServer?.id;
          const theirs = fresh && live && !!n && n.by === "partner" && noteState(n, now()) === "active";
          set({
            noteServer: merged,
            noteAvailable: true,
            lastSyncAt: now(),
            ...(theirs && n
              ? { noteIncomingSeq: cur.noteIncomingSeq + 1, noteIncoming: { byName: n.byName, kind: n.kind, at: n.createdAt } }
              : null),
          });
        };
        let boardFetch: Promise<void> | null = null;
        /** Rilegge la lavagna (biglietto + posizioni). Silenziosa: l'app va avanti anche se fallisce. */
        const refreshBoard = (): Promise<void> => {
          if (boardFetch) return boardFetch;
          boardFetch = (async () => {
            try {
              const b = await backend.getBoard();
              if (b === null) return void set({ noteAvailable: false });
              ingestNote(b.note, false);
              set({ noteAvailable: true, loc: b.location });
            } finally {
              boardFetch = null;
            }
          })();
          return boardFetch;
        };
        const gamesSlice = (): GamesSlice => ({
          gamesServer: get().gamesServer,
          gameScores: get().gameScores,
          gameDecks: get().gameDecks,
          gameMine: get().gameMine,
        });
        /** Una partita nuova dal server (tempo reale o risposta a una mia mossa). */
        const ingestGame = (g: GameRow, live: boolean) => {
          const cur = get();
          const { slice, changed, prev } = mergeGame(gamesSlice(), g);
          if (!changed) return;
          const change = live && cur.userId ? describeChange(prev, g, cur.userId) : null;
          set({
            ...slice,
            gamesAvailable: true,
            lastSyncAt: now(),
            ...(change ? { gameIncomingSeq: cur.gameIncomingSeq + 1, gameIncoming: { kind: g.kind, change, at: now() } } : null),
          });
          // Punteggi, mazzi e i miei segreti non viaggiano nell'evento: si rileggono quando serve.
          if (g.status !== "open" || g.kind === "quiz") void refreshGames().catch(() => {});
        };
        let gamesFetch: Promise<void> | null = null;
        const refreshGames = (): Promise<void> => {
          if (gamesFetch) return gamesFetch;
          gamesFetch = (async () => {
            try {
              const snap = await backend.getGames();
              if (snap === null) return void set({ gamesAvailable: false });
              const before = get();
              set({ ...mergeSnapshot(gamesSlice(), snap), gamesAvailable: true });
              // Una novità può arrivare PRIMA di questa lettura (che la contiene già) o mentre eri offline: l'evento in
              // tempo reale allora non la segnala più. Se le partite erano già caricate, avviso da qui (una sola volta).
              if (before.gamesAvailable === true && before.userId) {
                for (const g of snap.games) {
                  const prev = before.gamesServer.find((x) => x.id === g.id) ?? null;
                  if (!prev && g.status !== "open") continue;
                  const change = describeChange(prev, g, before.userId);
                  if (change) {
                    set((c) => ({ gameIncomingSeq: c.gameIncomingSeq + 1, gameIncoming: { kind: g.kind, change, at: now() } }));
                    break;
                  }
                }
              }
            } finally {
              gamesFetch = null;
            }
          })();
          return gamesFetch;
        };
        // ---------- sessione 7: eventi, domanda vera, ricordi ----------
        const romeToday = () => romeDayKey(now());
        const bumpExtra = (inc: ExtraIncoming) => set((c) => ({ extraIncomingSeq: c.extraIncomingSeq + 1, extraIncoming: inc }));
        const ingestEvents = (list: CountdownEvent[], live: boolean) => {
          const cur = get();
          if (live && cur.eventsAvailableSeen) {
            const fresh = list.find((e) => !cur.eventsServer.some((x) => x.id === e.id) && e.by && e.by !== cur.userId);
            if (fresh) bumpExtra({ what: "event", title: fresh.title });
          }
          set({ eventsServer: list, extraAvailable: true, eventsAvailableSeen: true, lastSyncAt: now() });
        };
        const ingestQa = (snap: QaSnapshot, live: boolean) => {
          const cur = get();
          if (live) {
            const day = romeToday();
            const before = cur.qaServer?.days.find((d) => d.day === day);
            const after = snap.days.find((d) => d.day === day);
            if (after && (!before || !before.theirs) && after.theirs && before?.mine) bumpExtra({ what: "qa-ready" });
            else if (after && before && !before.theirsAnswered && after.theirsAnswered && !after.mine) bumpExtra({ what: "qa-answered" });
          }
          set({ qaServer: snap, extraAvailable: true });
        };
        const ingestQaDay = (d: QaDay) => set({ qaServer: mergeQaDay(get().qaServer, d, romeToday()), extraAvailable: true });
        const ingestMemories = (list: Memory[], live: boolean) => {
          const cur = get();
          if (live && cur.memoriesSeen) {
            const fresh = list.find((m) => !cur.memoriesServer.some((x) => x.id === m.id) && m.by !== cur.userId);
            if (fresh) bumpExtra({ what: "memory", kind: fresh.kind });
          }
          set({ memoriesServer: list, extraAvailable: true, memoriesSeen: true, lastSyncAt: now() });
        };
        const ingestMemory = (m: Memory) => {
          const cur = get();
          set({ memoriesServer: [m, ...cur.memoriesServer.filter((x) => x.id !== m.id)], extraAvailable: true });
        };
        let extraFetch: Promise<void> | null = null;
        let extraWhat = new Set<"events" | "qa" | "memories">();
        /** Rilegge le parti richieste. Silenziosa: se la migrazione manca, `extraAvailable` diventa false e l'app va avanti. */
        const refreshExtraParts = (parts: ("events" | "qa" | "memories")[], live = false): Promise<void> => {
          parts.forEach((p) => extraWhat.add(p));
          if (extraFetch) return extraFetch;
          extraFetch = (async () => {
            try {
              while (extraWhat.size) {
                const todo = [...extraWhat];
                extraWhat = new Set();
                const cur = get();
                if (!cur.coupleId) return;
                if (todo.includes("events")) {
                  const ev = await backend.getEvents();
                  if (ev === null) return void set({ extraAvailable: false });
                  ingestEvents(ev, live);
                }
                if (todo.includes("qa")) {
                  const q = await backend.getQa(questionRefForDay(cur.coupleId, romeToday()));
                  if (q === null) return void set({ extraAvailable: false });
                  ingestQa(q, live);
                }
                if (todo.includes("memories")) {
                  const m = await backend.getMemories();
                  if (m === null) return void set({ extraAvailable: false });
                  ingestMemories(m, live);
                }
              }
            } finally {
              extraFetch = null;
            }
          })();
          return extraFetch;
        };
        const refreshExtra = () => refreshExtraParts(["events", "qa", "memories"]);
        const ensureToken = async () => {
          const cur = get();
          if (cur.widgetToken || !cur.coupleId || cur.noteAvailable !== true) return;
          try {
            const token = await backend.rotateWidgetToken();
            set({ widgetToken: token });
          } catch {
            /* riprova alla prossima sincronizzazione */
          }
        };

        const ingest = (input: RemoteInput) => {
          const before = get();
          let next: SyncedState;
          if (input.kind === "snapshot")
            next = applySnapshot(synced(), input.state, input.day, before.queue, QUESTION_IDS);
          else {
            const ev = input.event;
            if (ev.type === "pet") return ingestPetEvent(ev.pet);
            if (ev.type === "note") {
              const c = get();
              return ingestNote(noteFromRow(ev.note, c.userId, c.members), true);
            }
            if (ev.type === "location") return void refreshBoard().catch(() => {});
            if (ev.type === "game") return ingestGame(ev.game, true);
            if (ev.type === "extra") return void refreshExtraParts([ev.what], true).catch(() => {});
            if (ev.type === "ping") {
              if (seenPings.has(ev.id)) return;
              seenPings.add(ev.id);
              if (seenPings.size > 100) seenPings.delete(seenPings.values().next().value as string);
            }
            next = applyEvent(synced(), input.event, input.day, QUESTION_IDS);
          }
          const incoming =
            next.pingsReceivedTotal > before.pingsReceivedTotal && input.kind === "event";
          const joined = before.members.length === 1 && next.members.length === 2;
          set({
            ...next,
            incomingSeq: incoming ? before.incomingSeq + 1 : before.incomingSeq,
            pairedSeq: joined ? before.pairedSeq + 1 : before.pairedSeq,
            // un evento in tempo reale è un dato fresco quanto una fotografia (serve al "aggiornato X fa" del widget)
            ...(input.kind === "event" ? { lastSyncAt: now() } : null),
          });
        };

        const resync = (): Promise<void> => {
          if (resyncing) return resyncing;
          resyncing = (async () => {
            const d = new Date(now());
            try {
              const prevCouple = get().coupleId;
              const state = await io(async () => {
                const st = await backend.getState(localDayKey(d), localDayStartMs(d));
                ingest({ kind: "snapshot", state: st, day: localDayKey(d) });
                return st;
              });
              set({ lastSyncAt: now() });
              // Il pet: una chiamata a parte. Se fallisce per un motivo che non è la rete, il resto dell'app va avanti.
              if (!state.paired || !state.couple) {
                set({ ...emptyPetSlice(), ...emptyNoteSlice(), ...emptyGamesSlice(),
                ...emptyExtraSlice(), noteAvailable: null, gamesAvailable: null, loc: emptyLocation(), petAvailable: null });
              } else {
                if (prevCouple && prevCouple !== state.couple.id)
                  set({ ...emptyNoteSlice(), ...emptyGamesSlice(),
                ...emptyExtraSlice(), loc: emptyLocation(), widgetToken: null });
                await refreshBoard().catch((e: unknown) => {
                  if (e instanceof BackendError && e.kind === "network") throw e;
                });
                void refreshExtra().catch(() => {});
                void refreshGames().catch(() => {}); // a parte: non rallenta né fa fallire la sincronizzazione principale
                await ensureToken();
                const snap = await backend.getPet().catch((e: unknown) => {
                  if (e instanceof BackendError && e.kind === "network") throw e;
                  return undefined;
                });
                if (snap === null) set({ petAvailable: false });
                else if (snap) {
                  const base = prevCouple && prevCouple !== state.couple.id ? emptyPetSlice() : petSlice();
                  set({ ...mergePetSnapshot(base, snap), petAvailable: true });
                }
              }
            } finally {
              resyncing = null;
            }
          })();
          return resyncing;
        };

        const execOp = async (op: QueuedOp) => {
          const { coupleId } = get();
          if (op.kind === "name") return backend.setDisplayName(op.name);
          if (!coupleId) throw new BackendError("not_paired");
          if (op.kind === "ping") return backend.sendPing(coupleId, op.key);
          if (op.kind === "pet" || op.kind === "petName") {
            const pet =
              op.kind === "pet"
                ? await backend.petAct({
                    kind: op.action.kind,
                    item: op.action.item,
                    amount: op.action.amount,
                    day: op.action.day,
                    key: op.key,
                    at: op.at,
                  })
                : await backend.setPetName(op.name, op.at, op.key);
            // La risposta del server porta il pet già aggiornato: lo prendo SUBITO, prima che l'operazione esca dalla
            // coda, così il pet non "torna indietro" (es. l'uovo che si richiude) fra la coda e la sincronizzazione.
            if (pet) ingestPetEvent(pet);
            return;
          }
          if (op.kind === "note") {
            const n = await backend.sendNote({ kind: op.noteKind, content: op.content, key: op.key, at: op.at });
            ingestNote(n, false); // il server risponde col biglietto vero (scadenza compresa), prima che esca dalla coda
            return;
          }
          if (op.kind === "gameStart") {
            ingestGame(await backend.startGame({ id: op.id, kind: op.game, params: op.params }), false);
            return;
          }
          if (op.kind === "gameMove") {
            ingestGame(await backend.gameMove({ gameId: op.gameId, move: op.move, key: op.key }), false);
            return;
          }
          if (op.kind === "gameAbandon") {
            ingestGame(await backend.abandonGame({ gameId: op.gameId, key: op.key }), false);
            return;
          }
          if (op.kind === "eventUpsert") {
            const e = op.event;
            ingestEvents(await backend.upsertEvent({ id: e.id, input: { title: e.title, date: e.date, time: e.time, icon: e.icon, featured: e.featured }, at: e.at }), false);
            return;
          }
          if (op.kind === "eventDelete") {
            ingestEvents(await backend.deleteEvent({ id: op.id, at: op.at }), false);
            return;
          }
          if (op.kind === "qaAnswer") {
            ingestQaDay(await backend.answerQa({ day: op.day, ref: op.ref, text: op.text, key: op.key }));
            return;
          }
          if (op.kind === "qaTomorrow") {
            ingestQaDay(await backend.setTomorrowQuestion(op.text));
            return;
          }
          if (op.kind === "memoryAdd") {
            ingestMemory(await backend.addMemory({ id: op.id, kind: op.memKind, source: op.source, caption: op.caption, day: op.day, path: null, w: null, h: null, bytes: null, content: op.content }));
            return;
          }
          if (op.kind === "memoryPhoto") {
            const path = `${coupleId}/${op.id}.jpg`;
            await backend.uploadMemoryPhoto({ path, uri: op.uri });
            ingestMemory(await backend.addMemory({ id: op.id, kind: "photo", source: "photo", caption: op.caption, day: op.day, path, w: op.w, h: op.h, bytes: op.bytes, content: null }));
            void discardPhoto(op.uri);
            return;
          }
          if (op.kind === "memoryDelete") {
            const path = (await backend.deleteMemory(op.id)) ?? op.path;
            if (path) await backend.removeMemoryFile(path);
            return;
          }
          if (op.kind === "noteClear") {
            const n = await backend.clearNote(isLocalNoteId(op.id) ? null : op.id);
            if (n) ingestNote(n, false);
            return;
          }
          if (op.kind === "mood") return backend.setMood(coupleId, op.moodId, op.key, op.at);
          if (op.kind === "answer")
            return backend.answerDaily(coupleId, op.day, op.questionId, op.answer, op.key);
          if (op.kind !== "startDate") return;
          const won = await backend.setStartDate(op.startDate, op.at);
          const s = get();
          // Il server decide: se un'altra scrittura più recente ha vinto, la adottiamo.
          if (won.startDate !== s.startDate && won.at >= s.startDateAt)
            set({ startDate: won.startDate, startDateAt: won.at });
        };

        const flush = (): Promise<void> => {
          if (flushing) return flushing;
          if (!get().queue.length) return Promise.resolve();
          flushing = (async () => {
            try {
              for (let round = 0; round < 5 && get().queue.length; round++) {
                const r = await io(async () => {
                const batch = get().queue;
                const r = await flushQueue(
                  batch,
                  execOp,
                  () => get().link === "offline" && backend.kind === "mock" && false,
                );
                const finished = new Set(
                  [...r.done, ...r.rejected.map((x) => x.op)].map((o) => o.key),
                );
                const bump = new Set(r.stoppedBy ? r.remaining.slice(0, 1).map((o) => o.key) : []);
                let s = synced();
                for (const { op } of r.rejected) s = rollbackOp(s, op);
                // Giochi: una mossa rifiutata esce dalla coda (la partita "torna indietro" da sola) e si avvisa con garbo.
                const gameRej = r.rejected.filter((x) => isGameOp(x.op));
                const lastGameRej = gameRej[gameRej.length - 1];
                const rejKind = (op: QueuedOp): GameKind | null =>
                  op.kind === "gameStart"
                    ? op.game
                    : op.kind === "gameMove" || op.kind === "gameAbandon"
                      ? (get().gamesServer.find((g) => g.id === op.gameId)?.kind ?? null)
                      : null;
                set((cur) => ({
                  ...s,
                  queue: cur.queue
                    .filter((q) => !finished.has(q.key))
                    .map((q) => (bump.has(q.key) ? { ...q, attempts: q.attempts + 1 } : q)),
                  // un "troppo presto" del pet non è un errore da mostrare: la cura sparisce da sola
                  rejectedSeq: r.rejected.some(
                    (x) => !(isPetOp(x.op) && x.error.kind === "cooldown") && !isGameOp(x.op),
                  )
                    ? cur.rejectedSeq + 1
                    : cur.rejectedSeq,
                  ...(lastGameRej
                    ? {
                        gameRejectedSeq: cur.gameRejectedSeq + 1,
                        gameRejected: {
                          kind: rejKind(lastGameRej.op),
                          error: (lastGameRej.error.kind === "game_rejected" ? lastGameRej.error.message : "invalid_move") as GameError,
                        },
                      }
                    : null),
                }));
                  return r;
                });
                if (r.stoppedBy === "network") {
                  goOffline();
                  return;
                }
                if (r.stoppedBy) return;
                if (r.done.length || r.rejected.length) await resync().catch(() => {});
                // finito solo se la coda è vuota: un'operazione messa in coda MENTRE si spediva (mosse veloci) non deve
                // aspettare il prossimo sondaggio
                if (!r.rejected.length && !get().queue.length) return;
              }
            } finally {
              flushing = null;
            }
          })();
          return flushing;
        };

        const schedulePoll = () => {
          if (pollTimer) clearTimeout(pollTimer);
          pollTimer = null;
          if (!started || !foreground || !get().coupleId) return;
          // Fino a quando l'altra persona non è entrata: ogni 4 s (rete di sicurezza del tempo reale).
          const waiting = get().members.length < 2;
          pollTimer = setTimeout(
            async () => {
              pollTimer = null;
              try {
                await resync();
                await flush();
              } catch (e) {
                if (!(e instanceof BackendError) || e.kind === "network") goOffline();
              }
              schedulePoll();
            },
            waiting ? 4000 : 45_000,
          );
        };

        const subscribeIfNeeded = () => {
          const { coupleId } = get();
          if (!coupleId || unsub) return;
          unsub = backend.subscribe(coupleId, {
            onEvent: (event) => ingest({ kind: "event", event, day: today() }),
            onStatus: (st) => {
              if (st === "live") {
                attempt = 0;
                useNet.getState().noteSuccess();
                set({ link: "live" });
                void resync()
                  .then(flush)
                  .catch(() => {});
              } else {
                set({ link: "offline" });
                teardown();
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(
                  () => {
                    retryTimer = null;
                    void connect();
                  },
                  backoffDelay(attempt++, rng),
                );
              }
            },
          });
        };

        const connect = async (): Promise<void> => {
          if (!started) return;
          if (!get().queue.length && !get().coupleId) set({ link: "connecting" });
          try {
            const { userId } = await backend.signInAnonymously();
            const prev = get();
            if (prev.userId && prev.userId !== userId && prev.coupleId) {
              // L'identità è cambiata: il vecchio posto nella coppia non è più nostro.
              teardown();
              set({
                ...initialSynced(today()),
                meName: prev.meName,
                partnerName: prev.partnerName,
                startDate: prev.startDate,
                startDateAt: prev.startDateAt,
                userId,
                queue: [],
                ...emptyPetSlice(),
                ...emptyNoteSlice(),
                ...emptyGamesSlice(),
                ...emptyExtraSlice(),
                noteAvailable: null,
                gamesAvailable: null,
                loc: emptyLocation(),
                widgetToken: null,
                petAvailable: null,
                sessionLost: true,
              });
            } else set({ userId });
            await resync();
            useNet.getState().noteSuccess();
            subscribeIfNeeded();
            if (!get().coupleId) set({ link: "live" });
            attempt = 0;
            schedulePoll();
            await flush();
          } catch (e) {
            if (e instanceof BackendError && e.kind === "session") {
              // sessione non valida: al prossimo giro se ne crea una nuova
              goOffline();
            } else goOffline();
          }
        };

        const kick = () => {
          if (!started) return;
          void flush().catch(() => {});
        };

        // Tocchi all'uovo: si raggruppano (un viaggio al server ogni mezzo secondo, non uno per tocco).
        let touchTimer: ReturnType<typeof setTimeout> | null = null;
        const flushTouches = () => {
          if (touchTimer) clearTimeout(touchTimer);
          touchTimer = null;
          const cur = get();
          if (!cur.pendingTouches || !cur.coupleId) return set({ pendingTouches: 0 });
          set({
            pendingTouches: 0,
            queue: enqueue(cur.queue, {
              key: uuid(),
              kind: "pet",
              at: cur.pendingTouchAt || now(),
              attempts: 0,
              action: { kind: "touch", item: null, amount: Math.min(10, cur.pendingTouches), day: today() },
            }),
          });
          kick();
        };

        const sessionReady = async (): Promise<ActionResult | null> => {
          try {
            const { userId } = await backend.signInAnonymously();
            set({ userId });
            return null;
          } catch (e) {
            return { ok: false, error: e instanceof BackendError ? e.kind : "unknown" };
          }
        };

        const failure = (e: unknown): ActionResult => ({
          ok: false,
          error: e instanceof BackendError ? e.kind : "unknown",
        });

        // Dopo il collegamento, ciò che hai scelto prima (umore, data) viene offerto al server: vince l'ultima scrittura.
        const pushLocal = () => {
          const s = get();
          let q = s.queue;
          if (s.myMood)
            q = enqueue(q, {
              key: uuid(),
              kind: "mood",
              at: s.myMood.at,
              attempts: 0,
              moodId: s.myMood.moodId,
              prev: { moodId: null, at: 0 },
            });
          if (s.startDate)
            q = enqueue(q, {
              key: uuid(),
              kind: "startDate",
              at: s.startDateAt || now(),
              attempts: 0,
              startDate: s.startDate,
              prev: { startDate: s.startDate, at: s.startDateAt },
            });
          if (q !== s.queue) set({ queue: q });
        };

        const after = async () => {
          try {
            await resync();
          } catch {
            /* lo riproverà il ciclo */
          }
          pushLocal();
          kick();
          subscribeIfNeeded();
          schedulePoll();
        };

        return {
          ...initialSynced(today()),
          hydrated: false,
          backendKind: backend.kind,
          link: "idle" as LinkStatus,
          incomingSeq: 0,
          pairedSeq: 0,
          rejectedSeq: 0,
          busy: false,
          petAvailable: null as boolean | null,
          petIncomingSeq: 0,
          petIncoming: null as PetIncoming | null,
          noteAvailable: null as boolean | null,
          noteIncomingSeq: 0,
          noteIncoming: null as NoteIncoming | null,
          gamesAvailable: null as boolean | null,
          gameIncomingSeq: 0,
          gameIncoming: null as GameIncoming | null,
          gameRejectedSeq: 0,
          gameRejected: null as GameRejection | null,
          extraIncomingSeq: 0,
          extraIncoming: null as ExtraIncoming | null,
          eventsAvailableSeen: false,
          memoriesSeen: false,
          ...emptyGamesSlice(),
                ...emptyExtraSlice(),
          loc: emptyLocation(),
          widgetToken: null as string | null,
          ...emptyNoteSlice(),
          pendingTouches: 0,
          pendingTouchAt: 0,
          ...emptyPetSlice(),
          queue: [],
          lastSyncAt: null,
          sessionLost: false,
          revealedDay: null,
          qaRevealedDay: null as string | null,

          setPartnerNameLocal: (name) => {
            const nm = name.trim().slice(0, 24);
            if (nm && !get().coupleId) set({ partnerName: nm });
          },
          markRevealed: () => set({ revealedDay: get().question.day }),
          markQaRevealed: (day) => set({ qaRevealedDay: day }),
          setMyName: (name) => {
            const nm = name.trim().slice(0, 24);
            if (!nm) return;
            const s = get();
            if (s.meName === nm) return;
            if (!s.coupleId) return set({ meName: nm });
            set({
              meName: nm,
              queue: enqueue(s.queue, {
                key: uuid(),
                kind: "name",
                at: now(),
                attempts: 0,
                name: nm,
                prev: s.meName,
              }),
            });
            kick();
          },
          setStartDate: (iso) => {
            const s = get();
            if (s.startDate === iso) return;
            const at = now();
            if (!s.coupleId) return set({ startDate: iso, startDateAt: at });
            set({
              startDate: iso,
              startDateAt: at,
              queue: enqueue(s.queue, {
                key: uuid(),
                kind: "startDate",
                at,
                attempts: 0,
                startDate: iso,
                prev: { startDate: s.startDate, at: s.startDateAt },
              }),
            });
            kick();
          },
          setMyMood: (mood) => {
            const s = get();
            const at = now();
            const prev = { moodId: s.myMood?.moodId ?? null, at: s.myMood?.at ?? 0 };
            if (!s.coupleId) return set({ myMood: { moodId: mood, at } });
            set({
              myMood: { moodId: mood, at },
              queue: enqueue(s.queue, {
                key: uuid(),
                kind: "mood",
                at,
                attempts: 0,
                moodId: mood,
                prev,
              }),
            });
            kick();
          },
          sendThought: () => {
            const s = rolloverDay(synced(), today(), QUESTION_IDS);
            const cur = get();
            if (!cur.coupleId || cur.members.length < 2) return false;
            const at = now();
            set({
              ...s,
              pingsSentToday: s.pingsSentToday + 1,
              lastPingSentAt: at,
              queue: enqueue(cur.queue, { key: uuid(), kind: "ping", at, attempts: 0 }),
            });
            kick();
            return true;
          },
          answerQuestion: (a) => {
            const s = rolloverDay(synced(), today(), QUESTION_IDS);
            const cur = get();
            if (s.question.myAnswer !== null || !cur.coupleId) return; // una risposta al giorno, non si cambia
            set({
              ...s,
              question: { ...s.question, myAnswer: a },
              queue: enqueue(cur.queue, {
                key: uuid(),
                kind: "answer",
                at: now(),
                attempts: 0,
                day: s.question.day,
                questionId: s.question.id,
                answer: a,
              }),
            });
            kick();
          },
          petAct: (kind, item) => {
            const cur = get();
            if (!cur.coupleId || !cur.myRole || !cur.userId) return { ok: false, error: "not_paired" };
            const me = { userId: cur.userId, role: cur.myRole };
            const view = replayPet(petSlice(), cur.queue, me, cur.pendingTouches, cur.pendingTouchAt, today());
            if (view.hatchedAt === null) return { ok: false, error: "not_hatched" };
            const at = now();
            const wait = cooldownLeft(kind, myLastAt(petSlice(), cur.queue, kind), at);
            if (wait > 0) return { ok: false, error: "cooldown", waitMs: wait };
            set({
              queue: enqueue(cur.queue, {
                key: uuid(),
                kind: "pet",
                at,
                attempts: 0,
                action: { kind, item: kind === "feed" ? (item ?? null) : null, amount: 1, day: today() },
              }),
            });
            kick();
            return { ok: true };
          },
          touchEgg: () => {
            const cur = get();
            if (!cur.coupleId || !cur.myRole || !cur.userId) return;
            const me = { userId: cur.userId, role: cur.myRole };
            if (replayPet(petSlice(), cur.queue, me, cur.pendingTouches, cur.pendingTouchAt, today()).hatchedAt !== null)
              return;
            set({ pendingTouches: cur.pendingTouches + 1, pendingTouchAt: now() });
            if (get().pendingTouches >= 10) flushTouches();
            else {
              if (touchTimer) clearTimeout(touchTimer);
              touchTimer = setTimeout(flushTouches, 600);
            }
          },
          setPetName: (name) => {
            const nm = cleanPetName(name);
            const cur = get();
            if (!nm || !cur.coupleId) return;
            set({
              queue: enqueue(cur.queue, { key: uuid(), kind: "petName", at: now(), attempts: 0, name: nm }),
            });
            kick();
          },
          sendNote: (kind, content) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            set({
              queue: enqueue(cur.queue, { key: uuid(), kind: "note", at: now(), attempts: 0, noteKind: kind, content }),
            });
            kick();
            return { ok: true };
          },
          clearNote: () => {
            const cur = get();
            const shown = replayNote(cur.noteServer, cur.queue, cur.meName);
            if (!shown || !cur.coupleId || noteState(shown, now()) !== "active") return;
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "noteClear", at: now(), attempts: 0, id: shown.id }) });
            kick();
          },
          startGame: (kind) => {
            const cur = get();
            if (!cur.coupleId || !cur.userId) return { ok: false, error: "not_paired" };
            const view = replayGames(gamesSlice(), cur.queue, cur.userId, otherOf(cur.members, cur.userId));
            if (view.games.some((g) => g.kind === kind && g.status === "open")) return { ok: false, error: "game_open" };
            const id = uuid();
            let params: GameParams = {};
            if (kind === "quiz") {
              const p = pickQuiz(cur.gameDecks.quiz ?? [], rng);
              params = { qids: p.picked, reset: p.reset };
            } else if (kind === "draw") {
              const w = pickWord(cur.gameDecks.draw ?? [], rng);
              params = { word: w.word, wordId: w.id, reset: w.reset };
            }
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "gameStart", at: now(), attempts: 0, id, game: kind, params }) });
            kick();
            return { ok: true, id };
          },
          gameMove: (gameId, move) => {
            const cur = get();
            if (!cur.coupleId) return;
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "gameMove", at: now(), attempts: 0, gameId, move }) });
            kick();
          },
          abandonGame: (gameId) => {
            const cur = get();
            if (!cur.coupleId) return;
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "gameAbandon", at: now(), attempts: 0, gameId }) });
            kick();
          },
          refreshGames: () => refreshGames(),
          saveEvent: (id, input) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            const title = cleanTitle(input.title);
            if (!title) return { ok: false, error: "title" };
            const bad = validateEventInput({ ...input, title });
            if (bad) return { ok: false, error: bad };
            const evId = id ?? uuid();
            const at = Math.max(now(), (cur.eventsServer.find((e) => e.id === evId)?.at ?? 0) + 1);
            const event: CountdownEvent = { id: evId, title, date: input.date, time: input.time, icon: input.icon, featured: input.featured, at };
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "eventUpsert", at, attempts: 0, event }) });
            kick();
            return { ok: true, id: evId };
          },
          removeEvent: (id) => {
            const cur = get();
            if (!cur.coupleId) return;
            const at = Math.max(now(), (cur.eventsServer.find((e) => e.id === id)?.at ?? 0) + 1);
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "eventDelete", at, attempts: 0, id }) });
            kick();
          },
          qaAnswer: (text) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            const t = cleanAnswer(text);
            if (!t) return { ok: false, error: "empty" };
            const day = romeToday();
            const mine = cur.qaServer?.days.find((d) => d.day === day)?.mine;
            if (mine || cur.queue.some((q) => q.kind === "qaAnswer" && q.day === day)) return { ok: false, error: "done" };
            const ref = cur.qaServer?.days.find((d) => d.day === day)?.ref ?? questionRefForDay(cur.coupleId, day);
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "qaAnswer", at: now(), attempts: 0, day, ref, text: t }) });
            kick();
            return { ok: true };
          },
          qaTomorrow: (text) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            const t = cleanQuestion(text);
            if (t.length < 3) return { ok: false, error: "short" };
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "qaTomorrow", at: now(), attempts: 0, text: t }) });
            kick();
            return { ok: true };
          },
          addPhoto: (p, caption, day) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            const id = uuid();
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "memoryPhoto", at: now(), attempts: 0, id, uri: p.uri, w: p.w, h: p.h, bytes: p.bytes, caption: cleanCaption(caption), day }) });
            kick();
            return { ok: true, id };
          },
          keepMemory: (a) => {
            const cur = get();
            if (!cur.coupleId) return { ok: false, error: "not_paired" };
            set({
              queue: enqueue(cur.queue, { key: uuid(), kind: "memoryAdd", at: now(), attempts: 0, id: a.id, memKind: a.kind, source: a.source, caption: cleanCaption(a.caption), day: a.day ?? romeToday(), content: a.content }),
            });
            kick();
            return { ok: true };
          },
          deleteMemory: (id) => {
            const cur = get();
            if (!cur.coupleId) return;
            const known = replayMemories(cur.memoriesServer, cur.queue, cur.userId ?? "", now()).find((m) => m.id === id);
            if (!known) return;
            const queuedPhoto = cur.queue.find((q) => q.kind === "memoryPhoto" && q.id === id);
            if (queuedPhoto && queuedPhoto.kind === "memoryPhoto") void discardPhoto(queuedPhoto.uri);
            const path = known.kind === "photo" ? `${cur.coupleId}/${id}.jpg` : null;
            set({ queue: enqueue(cur.queue, { key: uuid(), kind: "memoryDelete", at: now(), attempts: 0, id, path }) });
            kick();
          },
          refreshExtra: () => refreshExtra(),
          signMemoryUrls: (paths) => backend.signMemoryUrls(paths),
          fetchMonth: async (year, month) => backend.getMonth(year, month),
          setLocationSharing: async (on) => {
            try {
              await backend.setLocationSharing(on);
              const cur = get();
              set({ loc: { ...cur.loc, sharing: on, me: on ? cur.loc.me : null } });
              void refreshBoard().catch(() => {});
              return { ok: true };
            } catch (e) {
              return failure(e);
            }
          },
          shareLocation: async (p) => {
            try {
              const at = now();
              await backend.setLocation({ ...p, at });
              const cur = get();
              set({ loc: { ...cur.loc, me: { ...p, at } } });
              void refreshBoard().catch(() => {});
              return { ok: true };
            } catch (e) {
              return failure(e);
            }
          },
          applyRemote: (input) => ingest(input),

          createCouple: async () => {
            set({ busy: true });
            try {
              const bad = await sessionReady();
              if (bad) return bad;
              const s = get();
              const r = await backend.createCouple(s.meName, s.startDate);
              set({
                coupleId: r.coupleId,
                myRole: r.role,
                joinCode: r.code,
                joinCodeExpiresAt: r.expiresAt,
                members: [{ userId: get().userId ?? "", displayName: s.meName, role: r.role }],
                sessionLost: false,
                link: "live",
              });
              started = true;
              await after();
              return { ok: true };
            } catch (e) {
              return failure(e);
            } finally {
              set({ busy: false });
            }
          },
          joinCouple: async (code) => {
            set({ busy: true });
            try {
              const bad = await sessionReady();
              if (bad) return bad;
              await backend.joinCouple(code, get().meName);
              set({ sessionLost: false, link: "live" });
              started = true;
              await after();
              return { ok: true };
            } catch (e) {
              return failure(e);
            } finally {
              set({ busy: false });
            }
          },
          renewCode: async () => {
            try {
              const r = await backend.renewCode();
              set({ joinCode: r.code, joinCodeExpiresAt: r.expiresAt });
              return { ok: true };
            } catch (e) {
              return failure(e);
            }
          },
          leaveCouple: async () => {
            set({ busy: true });
            try {
              await backend.leave();
              teardown();
              const s = get();
              set({
                ...initialSynced(today()),
                meName: s.meName,
                partnerName: s.partnerName,
                startDate: s.startDate,
                startDateAt: s.startDateAt,
                userId: s.userId,
                queue: [],
                ...emptyPetSlice(),
                ...emptyNoteSlice(),
                ...emptyGamesSlice(),
                ...emptyExtraSlice(),
                noteAvailable: null,
                gamesAvailable: null,
                loc: emptyLocation(),
                widgetToken: null,
                petAvailable: null,
                pendingTouches: 0,
                lastSyncAt: null,
              });
              return { ok: true };
            } catch (e) {
              return failure(e);
            } finally {
              set({ busy: false });
            }
          },
          releasePartner: async () => {
            try {
              const r = await backend.releasePartner();
              set({ joinCode: r.code, joinCodeExpiresAt: r.expiresAt });
              await after();
              return { ok: true };
            } catch (e) {
              return failure(e);
            }
          },
          dismissSessionLost: () => set({ sessionLost: false }),

          // le funzioni del motore vivono nella closure; le espongo sotto `engine`
          __engine: {
            start: () => {
              if (started) return;
              started = true;
              void connect();
            },
            stop: () => {
              started = false;
              clearTimers();
              teardown();
              set({ link: "idle" });
            },
            setForeground: (active: boolean) => {
              foreground = active;
              if (!active) flushTouches();
              backend.setForeground?.(active);
              if (!started) return;
              if (!active) {
                clearTimers();
                return;
              }
              attempt = 0;
              void connect();
            },
            networkBack: () => {
              if (!started || !foreground) return;
              attempt = 0;
              if (retryTimer) clearTimeout(retryTimer);
              retryTimer = null;
              void connect();
            },
            resync,
            flush,
          },
        };
      },
      {
        name: deps.storageName ?? "fragolina.couple.v2",
        storage: createJSONStorage(() => deps.storage ?? safeStorage),
        version: COUPLE_VERSION,
        migrate: (persisted, version) => migrateCouple(persisted, version) as unknown as CoupleState,
        partialize: (s) =>
          ({
            ...pickSynced(s),
            queue: s.queue,
            lastSyncAt: s.lastSyncAt,
            sessionLost: s.sessionLost,
            revealedDay: s.revealedDay,
            qaRevealedDay: s.qaRevealedDay,
            petServer: s.petServer,
            petLog: s.petLog,
            petMyLast: s.petMyLast,
            noteServer: s.noteServer,
            eventsServer: s.eventsServer,
            qaServer: s.qaServer,
            memoriesServer: s.memoriesServer,
            gamesServer: s.gamesServer,
            gameScores: s.gameScores,
            gameDecks: s.gameDecks,
            gameMine: s.gameMine,
            loc: s.loc,
            widgetToken: s.widgetToken,
          }) as unknown as CoupleState,
        onRehydrateStorage: () => () => {
          useCouple.setState({ hydrated: true });
        },
      },
    ),
  );

  const engine = (): Engine => useCouple.getState().__engine;
  return {
    useCouple,
    engine: {
      start: () => engine().start(),
      stop: () => engine().stop(),
      setForeground: (a: boolean) => engine().setForeground(a),
      networkBack: () => engine().networkBack(),
      resync: () => engine().resync(),
      flush: () => engine().flush(),
    },
  };
}

export type Pairing = "unpaired" | "waiting" | "paired";
export const selectPairing = (s: Pick<CoupleState, "coupleId" | "members">): Pairing =>
  !s.coupleId ? "unpaired" : s.members.length >= 2 ? "paired" : "waiting";
export const selectPingsToday = (
  s: Pick<CoupleState, "pingsDay" | "pingsSentToday">,
  day = localDayKey(),
) => (s.pingsDay === day ? s.pingsSentToday : 0);
export const selectQuestion = (s: Pick<CoupleState, "question">, day = localDayKey()) => {
  const def = S.questions.find((q) => q.id === s.question.id) ?? S.questions[0];
  return s.question.day === day
    ? { ...s.question, ...def }
    : { day, ...fresh(day), ...fresh2(day) };
};
// domanda del giorno senza risposte (quando il giorno è cambiato e non c'è ancora stata una sincronizzazione)
function fresh(day: string) {
  const id = questionIdForDay(day, QUESTION_IDS);
  return { id, myAnswer: null as DailyAnswer | null, partnerAnswer: null as DailyAnswer | null };
}
function fresh2(day: string) {
  return S.questions.find((q) => q.id === questionIdForDay(day, QUESTION_IDS)) ?? S.questions[0];
}
