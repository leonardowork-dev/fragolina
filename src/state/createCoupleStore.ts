import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import { ME_NAME, PARTNER_NAME } from "@/config/couple";
import type { MoodId } from "@/features/home/moods";
import type { Backend } from "@/lib/backend/types";
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
};

type Engine = {
  start: () => void;
  stop: () => void;
  setForeground: (a: boolean) => void;
  resync: () => Promise<void>;
  flush: () => Promise<void>;
};

export type CoupleState = SyncedState &
  Ephemeral & {
    queue: QueuedOp[];
    lastSyncAt: number | null;
    /** La sessione anonima è stata sostituita (app reinstallata, portachiavi perso): la coppia va ricollegata. */
    sessionLost: boolean;
    setMyName: (name: string) => void;
    setStartDate: (iso: string) => void;
    setMyMood: (mood: MoodId) => void;
    sendThought: () => boolean;
    answerQuestion: (a: DailyAnswer) => void;
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

        const ingest = (input: RemoteInput) => {
          const before = get();
          let next: SyncedState;
          if (input.kind === "snapshot")
            next = applySnapshot(synced(), input.state, input.day, before.queue, QUESTION_IDS);
          else {
            const ev = input.event;
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
              ingest({ kind: "snapshot", state, day: localDayKey(d) });
              set({ lastSyncAt: now() });
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
          if (op.kind === "mood") return backend.setMood(coupleId, op.moodId, op.key, op.at);
          if (op.kind === "answer")
            return backend.answerDaily(coupleId, op.day, op.questionId, op.answer, op.key);
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
                  rejectedSeq: r.rejected.length ? cur.rejectedSeq + 1 : cur.rejectedSeq,
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
