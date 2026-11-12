import { WIDGET_SCHEMA_VERSION } from "@/config/couple";
import { S } from "@/lib/strings.it";

/**
 * Contenuto dello snapshot che l'app scrive nell'App Group e il widget legge (struct `Snapshot` in
 * targets/widget/FragolinaWidget.swift). Funzioni PURE, provate in tests/widgetPayload.test.ts contro la
 * fixture tests/fixtures/widget-snapshot.json, che è anche il modello del Codable Swift.
 * Il widget calcola da solo i giorni da `startDate` (scattano a mezzanotte anche con l'app chiusa).
 */
export type WidgetSnapshot = {
  v: number;
  /** Ultimo momento in cui l'app ha confermato i dati col server (ms). Serve al "aggiornato X fa". */
  updatedAt: number;
  paired: boolean;
  partnerName: string;
  moodId: string | null;
  moodLabel: string;
  moodAt: number | null;
  /** Pensieri che HAI mandato oggi. */
  thinkingToday: number;
  /** Pensieri che HAI ricevuto in totale. */
  pingsReceived: number;
  /** Ultimo pensiero ricevuto (ms). */
  lastPingAt: number | null;
  startDate: string | null;
  // ---- v3 ----
  /** Il mio nome (widget "noi due"). */
  myName: string;
  /** Il mio umore (widget "noi due"). */
  myMoodId: string | null;
  myMoodLabel: string;
  myMoodAt: number | null;
  /** Domanda del giorno, testo corto (max 60 caratteri). Vuoto se non collegati. */
  questionText: string;
  /** Ho già risposto io. */
  questionMineDone: boolean;
  /** Abbiamo risposto entrambi (il server mostra la risposta di lei solo dopo la mia: prima è sempre false). */
  questionBothDone: boolean;
};

export const QUESTION_MAX = 60;

export type WidgetSource = {
  coupleId: string | null;
  members: unknown[];
  partnerName: string;
  partnerMood: { moodId: string; at: number } | null;
  pingsDay: string;
  pingsSentToday: number;
  pingsReceivedTotal: number;
  lastPingReceivedAt: number | null;
  startDate: string | null;
  lastSyncAt: number | null;
  meName: string;
  myMood: { moodId: string; at: number } | null;
  /** Domanda di oggi già risolta (testo + risposte), o null se non disponibile. */
  question: { text: string; myAnswer: unknown | null; partnerAnswer: unknown | null } | null;
};

const clip = (t: string, n: number) => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…");
const moodLabelOf = (id: string) => (S.moods as Record<string, string>)[id] ?? "";

export function buildSnapshot(s: WidgetSource, now: number, today: string): WidgetSnapshot {
  const paired = !!s.coupleId && s.members.length >= 2;
  const mood = paired ? s.partnerMood : null;
  const mine = paired ? s.myMood : null;
  const q = paired ? s.question : null;
  return {
    v: WIDGET_SCHEMA_VERSION,
    updatedAt: paired ? (s.lastSyncAt ?? now) : now,
    paired,
    partnerName: s.partnerName,
    moodId: mood?.moodId ?? null,
    moodLabel: mood ? moodLabelOf(mood.moodId) : "",
    moodAt: mood?.at ?? null,
    thinkingToday: paired && s.pingsDay === today ? s.pingsSentToday : 0,
    pingsReceived: paired ? s.pingsReceivedTotal : 0,
    lastPingAt: paired ? s.lastPingReceivedAt : null,
    startDate: s.startDate,
    myName: s.meName,
    myMoodId: mine?.moodId ?? null,
    myMoodLabel: mine ? moodLabelOf(mine.moodId) : "",
    myMoodAt: mine?.at ?? null,
    questionText: q ? clip(q.text, QUESTION_MAX) : "",
    questionMineDone: !!q && q.myAnswer !== null,
    questionBothDone: !!q && q.myAnswer !== null && q.partnerAnswer !== null,
  };
}

const KEYS: (keyof WidgetSnapshot)[] = [
  "v",
  "updatedAt",
  "paired",
  "partnerName",
  "moodId",
  "moodLabel",
  "moodAt",
  "thinkingToday",
  "pingsReceived",
  "lastPingAt",
  "startDate",
  "myName",
  "myMoodId",
  "myMoodLabel",
  "myMoodAt",
  "questionText",
  "questionMineDone",
  "questionBothDone",
];

/** JSON con l'ordine delle chiavi fisso (diff leggibili, firma stabile). */
export function encodeSnapshot(snap: WidgetSnapshot): string {
  const o: Record<string, unknown> = {};
  for (const k of KEYS) o[k] = snap[k];
  return JSON.stringify(o);
}

/** Legge un payload (anche vecchio, v1 o v2, o incompleto) senza mai lanciare. Restituisce null se illeggibile. */
export function decodeSnapshot(raw: string): WidgetSnapshot | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      v: num(o.v) ?? 1,
      updatedAt: num(o.updatedAt) ?? 0,
      paired: typeof o.paired === "boolean" ? o.paired : str(o.partnerName) !== null, // v1 non aveva `paired`
      partnerName: str(o.partnerName) ?? "",
      moodId: str(o.moodId),
      moodLabel: str(o.moodLabel) ?? "",
      moodAt: num(o.moodAt),
      thinkingToday: num(o.thinkingToday) ?? 0,
      pingsReceived: num(o.pingsReceived) ?? 0,
      lastPingAt: num(o.lastPingAt),
      startDate: str(o.startDate),
      myName: str(o.myName) ?? "",
      myMoodId: str(o.myMoodId),
      myMoodLabel: str(o.myMoodLabel) ?? "",
      myMoodAt: num(o.myMoodAt),
      questionText: str(o.questionText) ?? "",
      questionMineDone: o.questionMineDone === true,
      questionBothDone: o.questionBothDone === true,
    };
  } catch {
    return null;
  }
}

/** Firma del contenuto senza `updatedAt`: serve a non riscrivere il widget se non è cambiato nulla. */
export function snapshotSignature(snap: WidgetSnapshot): string {
  return encodeSnapshot({ ...snap, updatedAt: 0 });
}
