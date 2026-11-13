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
import { localDayKey, localDayStartMs } from "@/lib/time";
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
  /** Tocchi all'uovo non ancora messi in coda (si raggruppano per mezzo secondo). */
  pendingTouches: number;
  pendingTouchAt: number;
};

type Engine = {
  start: () => void;
  stop: () => void;
  setForeground: (a: boolean) => void;
  resync: () => Promise<void>;
  flush: () => Promise<void>;
};

export type CoupleState = SyncedState &
  PetSlice &
  NoteSlice &
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
              const state = await backend.getState(localDayKey(d), localDayStartMs(d));
              const prevCouple = get().coupleId;
              ingest({ kind: "snapshot", state, day: localDayKey(d) });
              set({ lastSyncAt: now() });
              // Il pet: una chiamata a parte. Se fallisce per un motivo che non è la rete, il resto dell'app va avanti.
              if (!state.paired || !state.couple) {
                set({ ...emptyPetSlice(), ...emptyNoteSlice(), noteAvailable: null, loc: emptyLocation(), petAvailable: null });
              } else {
                if (prevCouple && prevCouple !== state.couple.id)
                  set({ ...emptyNoteSlice(), loc: emptyLocation(), widgetToken: null });
                await refreshBoard().catch((e: unknown) => {
                  if (e instanceof BackendError && e.kind === "network") throw e;
                });
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
                set((cur) => ({
                  ...s,
                  queue: cur.queue
                    .filter((q) => !finished.has(q.key))
                    .map((q) => (bump.has(q.key) ? { ...q, attempts: q.attempts + 1 } : q)),
                  // un "troppo presto" del pet non è un errore da mostrare: la cura sparisce da sola
                  rejectedSeq: r.rejected.some((x) => !(isPetOp(x.op) && x.error.kind === "cooldown"))
                    ? cur.rejectedSeq + 1
                    : cur.rejectedSeq,
                }));
                if (r.stoppedBy === "network") {
                  goOffline();
                  return;
                }
                if (r.stoppedBy) return;
                if (r.done.length || r.rejected.length) await resync().catch(() => {});
                if (!r.rejected.length) return;
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
                noteAvailable: null,
                loc: emptyLocation(),
                widgetToken: null,
                petAvailable: null,
                sessionLost: true,
              });
            } else set({ userId });
            await resync();
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

          setPartnerNameLocal: (name) => {
            const nm = name.trim().slice(0, 24);
            if (nm && !get().coupleId) set({ partnerName: nm });
          },
          markRevealed: () => set({ revealedDay: get().question.day }),
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
                noteAvailable: null,
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
            resync,
            flush,
          },
        };
      },
      {
        name: deps.storageName ?? "fragolina.couple.v2",
        storage: createJSONStorage(() => deps.storage ?? safeStorage),
        version: 2,
        migrate: (persisted) => persisted as CoupleState,
        partialize: (s) =>
          ({
            ...pickSynced(s),
            queue: s.queue,
            lastSyncAt: s.lastSyncAt,
            sessionLost: s.sessionLost,
            revealedDay: s.revealedDay,
            petServer: s.petServer,
            petLog: s.petLog,
            petMyLast: s.petMyLast,
            noteServer: s.noteServer,
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
