import type { MoodId } from "@/features/home/moods";
import type { GameKind, GameMove, GameParams, GameRow } from "@/lib/games/types";
import type { NoteContent, NoteKind, NoteRow } from "@/lib/note/rules";
import type { FoodId, PetKind, PetState } from "@/lib/pet/rules";
import type { CountdownEvent } from "@/lib/countdown/rules";
import type { MemoryKind, MemorySource } from "@/lib/memories/types";

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
  | { type: "location" }
  /** Una partita è cambiata (riga di `games`: stato PUBBLICO, mai i segreti). */
  | { type: "game"; game: GameRow }
  /** Qualcosa è cambiato in una tabella della sessione 7: il telefono rilegge la parte giusta. */
  | { type: "extra"; what: "events" | "qa" | "memories" };

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
  | { key: string; kind: "noteClear"; at: number; attempts: number; id: string }
  /** Giochi (sessione 6). `id` = id della partita (deciso dal telefono, quindi idempotente). */
  | { key: string; kind: "gameStart"; at: number; attempts: number; id: string; game: GameKind; params: GameParams }
  | { key: string; kind: "gameMove"; at: number; attempts: number; gameId: string; move: GameMove }
  | { key: string; kind: "gameAbandon"; at: number; attempts: number; gameId: string }
  /** Conto alla rovescia (sessione 7): crea/modifica un evento (last-write-wins per `event.at`) o lo cancella. */
  | { key: string; kind: "eventUpsert"; at: number; attempts: number; event: CountdownEvent }
  | { key: string; kind: "eventDelete"; at: number; attempts: number; id: string }
  /** Domanda del giorno vera: la mia risposta (una al giorno) e la domanda di domani che scrivo io. */
  | { key: string; kind: "qaAnswer"; at: number; attempts: number; day: string; ref: string; text: string }
  | { key: string; kind: "qaTomorrow"; at: number; attempts: number; text: string }
  /** Ricordi: un biglietto/disegno tenuto, una foto da caricare (file locale) o una cancellazione (anche dallo Storage). */
  | {
      key: string;
      kind: "memoryAdd";
      at: number;
      attempts: number;
      id: string;
      memKind: Exclude<MemoryKind, "photo">;
      source: Exclude<MemorySource, "photo">;
      caption: string;
      day: string;
      content: NoteContent;
    }
  | {
      key: string;
      kind: "memoryPhoto";
      at: number;
      attempts: number;
      id: string;
      uri: string;
      w: number;
      h: number;
      bytes: number;
      caption: string;
      day: string;
    }
  | { key: string; kind: "memoryDelete"; at: number; attempts: number; id: string; path: string | null };

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
  | "not_your_turn" // la domanda di domani la scrive l'altra persona
  | "not_yours" // un ricordo lo toglie solo chi l'ha aggiunto
  | "no_file" // la foto non è (ancora) nello Storage
  /** Il server ha rifiutato una mossa dei giochi: il messaggio è il codice (`not_your_turn`, `cell_taken`…). */
  | "game_rejected"
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
