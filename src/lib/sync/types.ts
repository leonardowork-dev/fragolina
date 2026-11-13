import type { MoodId } from "@/features/home/moods";
import type { NoteContent, NoteKind, NoteRow } from "@/lib/note/rules";
import type { FoodId, PetKind, PetState } from "@/lib/pet/rules";

export type DailyAnswer = "a" | "b";
export type Role = "a" | "b";

export type Member = { userId: string; displayName: string; role: Role };
export type Stamped<T> = T & { at: number }; // ms epoch (orario "logico" dell'evento, usato per last-write-wins)

/** Fotografia completa restituita da Backend.getState (una sola per volta, autorevole). */
export type RemoteState = {
  paired: boolean; // false = questo utente non è in nessuna coppia
  userId: string;
  couple: {
    id: string;
    joinCode: string | null;
    joinCodeExpiresAt: number | null;
    startDate: string | null; // AAAA-MM-GG
    startDateAt: number;
  } | null;
  members: Member[];
  myMood: { moodId: MoodId; at: number } | null;
  partnerMood: { moodId: MoodId; at: number } | null;
  pingsSentToday: number;
  pingsReceivedTotal: number;
  lastPingReceivedAt: number | null;
  lastPingSentAt: number | null;
  myAnswer: { questionId: string; answer: DailyAnswer; at: number } | null;
  /** Presente solo se hai già risposto tu (regola di rivelazione applicata dal server). */
  partnerAnswer: { questionId: string; answer: DailyAnswer; at: number } | null;
};

/** Eventi in tempo reale (già normalizzati, con la RLS applicata dal server). */
export type RemoteEvent =
  | { type: "ping"; id: string; fromUserId: string; at: number }
  | { type: "mood"; userId: string; moodId: MoodId; at: number }
  | {
      type: "answer";
      userId: string;
      day: string;
      questionId: string;
      answer: DailyAnswer;
      at: number;
    }
  | {
      type: "couple";
      startDate: string | null;
      startDateAt: number;
      joinCode: string | null;
      joinCodeExpiresAt: number | null;
    }
  | { type: "member-joined"; member: Member }
  | { type: "member-left"; userId: string }
  | { type: "member-renamed"; userId: string; displayName: string }
  /** La riga del pet è cambiata (qualcuno l'ha curato, nome, schiusa). */
  | { type: "pet"; pet: PetState }
  /** Un biglietto è nato o è stato pulito (riga della tabella notes). */
  | { type: "note"; note: NoteRow }
  /** La posizione di qualcuno è cambiata: il telefono rilegge la lavagna (get_board). */
  | { type: "location" };

export type RemoteInput =
  | { kind: "snapshot"; state: RemoteState; day: string }
  | { kind: "event"; event: RemoteEvent; day: string };

export type LinkStatus = "idle" | "connecting" | "live" | "offline";

/** Operazioni in coda (persistite). `key` = chiave di idempotenza, uguale sul server e nel client. */
export type QueuedOp =
  | { key: string; kind: "ping"; at: number; attempts: number }
  | {
      key: string;
      kind: "mood";
      at: number;
      attempts: number;
      moodId: MoodId;
      prev: { moodId: MoodId | null; at: number };
    }
  | {
      key: string;
      kind: "answer";
      at: number;
      attempts: number;
      day: string;
      questionId: string;
      answer: DailyAnswer;
    }
  | {
      key: string;
      kind: "startDate";
      at: number;
      attempts: number;
      startDate: string;
      prev: { startDate: string | null; at: number };
    }
  | { key: string; kind: "name"; at: number; attempts: number; name: string; prev: string }
  | {
      key: string;
      kind: "pet";
      at: number;
      attempts: number;
      action: { kind: PetKind; item: FoodId | null; amount: number; day: string };
    }
  | { key: string; kind: "petName"; at: number; attempts: number; name: string }
  | { key: string; kind: "note"; at: number; attempts: number; noteKind: NoteKind; content: NoteContent }
  /** `id` = biglietto da pulire (`local-<chiave>` se è ancora in coda: allora si pulisce l'ultimo). */
  | { key: string; kind: "noteClear"; at: number; attempts: number; id: string };

export type BackendErrorKind =
  | "network" // nessuna rete / timeout: si riprova
  | "session" // sessione scaduta o non valida
  | "rate_limited"
  | "invalid_code"
  | "code_expired"
  | "couple_full"
  | "already_paired"
  | "not_paired"
  | "closed"
  | "name_required"
  | "invalid_date"
  | "no_partner"
  | "cooldown" // il pet ha appena fatto la stessa cosa: troppo presto
  | "not_hatched"
  | "invalid_action"
  | "invalid_content" // il biglietto non rispetta i limiti
  | "not_sharing"
  | "invalid_location"
  | "unknown";

export class BackendError extends Error {
  readonly kind: BackendErrorKind;
  constructor(kind: BackendErrorKind, message?: string) {
    super(message ?? kind);
    this.name = "BackendError";
    this.kind = kind;
  }
  /** Vale la pena riprovare più tardi con la stessa operazione. */
  get retryable() {
    return this.kind === "network" || this.kind === "rate_limited" || this.kind === "unknown";
  }
}

export const isBackendError = (e: unknown): e is BackendError => e instanceof BackendError;
