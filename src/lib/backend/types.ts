import type { MoodId } from "@/features/home/moods";
import type { DailyAnswer, Member, RemoteEvent, RemoteState } from "@/lib/sync/types";

export type CoupleCreated = { coupleId: string; code: string; expiresAt: number; role: "a" | "b" };
export type CoupleJoined = { coupleId: string; role: "a" | "b" };
export type CodeRenewed = { code: string; expiresAt: number };

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
  /** App in primo piano o no (rinnovo del token). Facoltativo. */
  setForeground?(active: boolean): void;
}

export type { Member };
