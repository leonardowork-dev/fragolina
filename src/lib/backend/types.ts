import type { MoodId } from "@/features/home/moods";
import type { GameKind, GameMove, GameParams, GameRow, GamesSnapshot } from "@/lib/games/types";
import type { Board } from "@/lib/note/wire";
import type { Note, NoteContent, NoteKind } from "@/lib/note/rules";
import type { FoodId, PetKind, PetState } from "@/lib/pet/rules";
import type { CountdownEvent, EventInput } from "@/lib/countdown/rules";
import type { Memory, MemoryKind, MemorySource } from "@/lib/memories/types";
import type { MonthRaw } from "@/lib/memories/month";
import type { QaDay, QaSnapshot } from "@/lib/qa/rules";
import type { PetSnapshot } from "@/lib/pet/sync";
import type { DailyAnswer, Member, RemoteEvent, RemoteState } from "@/lib/sync/types";

export type CoupleCreated = { coupleId: string; code: string; expiresAt: number; role: "a" | "b" };
export type CoupleJoined = { coupleId: string; role: "a" | "b" };
export type CodeRenewed = { code: string; expiresAt: number };

/** Una cura del pet, come la manda il telefono. `key` = chiave di idempotenza. */
export type PetActInput = {
  kind: PetKind;
  item: FoodId | null;
  amount: number;
  day: string;
  key: string;
  at: number;
};

export type SubscriptionHandlers = {
  onEvent: (e: RemoteEvent) => void;
  /** 'live' = sottoscrizione attiva; 'down' = persa (rete o server): il motore riprova con backoff. */
  onStatus: (s: "live" | "down") => void;
};

/**
 * Tutto ciò che l'app sa del server. L'interfaccia è identica per Supabase e per la prova locale (MockBackend):
 * l'interfaccia grafica non sa quale delle due sta usando. Gli errori sono sempre `BackendError`.
 */
export interface Backend {
  readonly kind: "supabase" | "mock";
  /** Ripristina la sessione salvata o ne crea una anonima nuova. Restituisce l'id utente. */
  signInAnonymously(): Promise<{ userId: string }>;
  createCouple(displayName: string, startDate: string | null): Promise<CoupleCreated>;
  joinCouple(code: string, displayName: string): Promise<CoupleJoined>;
  renewCode(): Promise<CodeRenewed>;
  leave(): Promise<void>;
  /** "Ha cambiato telefono": libera il posto dell'altra persona. */
  releasePartner(): Promise<CodeRenewed>;
  getState(day: string, dayStartMs: number): Promise<RemoteState>;
  subscribe(coupleId: string, handlers: SubscriptionHandlers): () => void;
  /** `key` = chiave di idempotenza: ripetere la stessa chiamata non crea duplicati. */
  sendPing(coupleId: string, key: string): Promise<void>;
  setMood(coupleId: string, moodId: MoodId, key: string, at: number): Promise<void>;
  answerDaily(
    coupleId: string,
    day: string,
    questionId: string,
    answer: DailyAnswer,
    key: string,
  ): Promise<void>;
  /** Last-write-wins sul server: restituisce il valore vincente. */
  setStartDate(startDate: string, at: number): Promise<{ startDate: string; at: number }>;
  setDisplayName(name: string): Promise<void>;
  /**
   * Il pet condiviso. `null` = il server non ha (ancora) le tabelle del pet (migrazione non eseguita): l'app resta
   * usabile e la scheda Pet dice che manca un passo.
   */
  getPet(): Promise<PetSnapshot | null>;
  /** Restituisce la riga del pet dopo la cura (null se il server non la manda): serve a non far "tornare indietro" il pet fra coda e sincronizzazione. */
  petAct(a: PetActInput): Promise<PetState | null>;
  /** Last-write-wins sul server. */
  setPetName(name: string, at: number, key: string): Promise<PetState | null>;
  /**
   * La lavagna: ultimo biglietto + posizioni. `null` = il server non ha la migrazione dei biglietti (sessione 5):
   * l'app resta usabile e la scheda Disegna dice che manca un passo.
   */
  getBoard(): Promise<Board | null>;
  /** Idempotente per `key`. Restituisce il biglietto come lo vede il server (scadenza vera). */
  sendNote(a: { kind: NoteKind; content: NoteContent; key: string; at: number }): Promise<Note>;
  /** Pulisce per entrambi. `id = null` = l'ultimo. Restituisce il biglietto pulito (o null se non c'era). */
  clearNote(id: string | null): Promise<Note | null>;
  /**
   * I mini giochi (sessione 6): partite aperte + l'ultima chiusa + album, punteggi, mazzi e i MIEI segreti.
   * `null` = il server non ha la migrazione dei giochi: l'app resta usabile e la scheda Gioca dice che manca un passo.
   */
  getGames(): Promise<GamesSnapshot | null>;
  /** Idempotente per `id` (id della partita, deciso dal telefono). Un rifiuto è `BackendError("game_rejected", codice)`. */
  startGame(a: { id: string; kind: GameKind; params: GameParams }): Promise<GameRow>;
  /** Idempotente per `key`. Il server valida turno, casella, fase; un rifiuto è `BackendError("game_rejected", codice)`. */
  gameMove(a: { gameId: string; move: GameMove; key: string }): Promise<GameRow>;
  abandonGame(a: { gameId: string; key: string }): Promise<GameRow>;
  /**
   * Conto alla rovescia (sessione 7). `null` = il server non ha la migrazione (sessione 7): l'app resta usabile e la scheda dice che manca un passo.
   * Tutte le chiamate restituiscono l'elenco intero come lo vede il server (last-write-wins per `at`).
   */
  getEvents(): Promise<CountdownEvent[] | null>;
  upsertEvent(a: { id: string; input: EventInput; at: number }): Promise<CountdownEvent[]>;
  deleteEvent(a: { id: string; at: number }): Promise<CountdownEvent[]>;
  /**
   * Domanda del giorno vera. `todayRef` = la domanda che questo telefono ha scelto per oggi: vale solo se nessuno ha ancora
   * aperto il giorno. La risposta dell'altro arriva SOLO se hai risposto anche tu (regola applicata dal server).
   */
  getQa(todayRef: string): Promise<QaSnapshot | null>;
  /** Una risposta al giorno (non si cambia). Restituisce il giorno com'è ora sul server. */
  answerQa(a: { day: string; ref: string; text: string; key: string }): Promise<QaDay>;
  /** Scrivi tu la domanda di domani (a turni): `BackendError("not_your_turn")` se non tocca a te. */
  setTomorrowQuestion(text: string): Promise<QaDay>;
  /** Ricordi (foto e biglietti tenuti). `null` = migrazione mancante. */
  getMemories(): Promise<Memory[] | null>;
  /** Idempotente per `id`. Per le foto il file deve essere già nello Storage (`uploadMemoryPhoto`). */
  addMemory(a: {
    id: string;
    kind: MemoryKind;
    source: MemorySource;
    caption: string;
    day: string;
    path: string | null;
    w: number | null;
    h: number | null;
    bytes: number | null;
    content: Memory["content"];
  }): Promise<Memory>;
  /** Solo chi l'ha aggiunto. Restituisce il percorso del file da togliere dallo Storage (null se non è una foto). */
  deleteMemory(id: string): Promise<string | null>;
  /** Carica il file (già ridotto) nello Storage, nella cartella della coppia. Idempotente: se c'è già, va bene. */
  uploadMemoryPhoto(a: { path: string; uri: string }): Promise<void>;
  removeMemoryFile(path: string): Promise<void>;
  /** URL firmati a scadenza breve (10 minuti) per vedere le foto: mai pubblici. */
  signMemoryUrls(paths: string[]): Promise<Record<string, string>>;
  /** "Il nostro mese": umori, pensieri, partite. */
  getMonth(year: number, month: number): Promise<MonthRaw | null>;
  setLocationSharing(on: boolean): Promise<void>;
  /** Posizione GIÀ arrotondata (centesimi di grado). */
  setLocation(p: { latE2: number; lonE2: number; at: number }): Promise<void>;
  /** Crea (o cambia) il token con cui il widget legge il feed. Il token in chiaro esiste solo qui e nel container del widget. */
  rotateWidgetToken(): Promise<string>;
  /** App in primo piano o no (rinnovo del token). Facoltativo. */
  setForeground?(active: boolean): void;
}

export type { Member };
