import { WIDGET_SCHEMA_VERSION } from "@/config/couple";
import type { LocationState } from "@/lib/geo/types";
import { type Note, type NoteContent, noteState } from "@/lib/note/rules";
import { type PetState, stageOf } from "@/lib/pet/rules";
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
  // ---- v4 (pet condiviso) ----
  /** Il pet è nato (false = uovo, o nessun pet ancora). */
  petHatched: boolean;
  /** egg | seed | sprout | berry | big. Vuoto se non collegati. */
  petStage: string;
  petName: string;
  /** Bisogni (0-1000) all'istante `petAt`: il widget li fa scendere da solo (stesse regole di src/lib/pet/rules.ts). */
  petFood: number;
  petLove: number;
  petEnergy: number;
  petAt: number | null;
  /** Fine della nanna (ms), 0 = non dorme. */
  petSleepUntil: number;
  /** Ultima cura vera (ms): serve a "torna a dormire dopo 3 giorni" e a "X fa". */
  petLastAt: number | null;
  /** Ultimo giorno di cura (AAAA-MM-GG) e se in quel giorno avete curato entrambi. */
  petDay: string;
  petBoth: boolean;
  /** Chi ha fatto l'ultima cura: "me", "partner" o vuoto. */
  petLastBy: string;
  /** feed | cuddle | play | sleep | hatch, o vuoto. */
  petLastKind: string;
  petLastItem: string;
  // ---- v5 (biglietto, distanza, accesso del widget al feed) ----
  /** Biglietto di adesso ("" = nessuno). Vettori, come sul server: il widget li ridisegna. Il widget calcola da solo la scadenza. */
  noteId: string;
  noteKind: string;
  noteContent: NoteContent | null;
  /** "me" | "partner" | "" */
  noteBy: string;
  noteByName: string;
  noteAt: number | null;
  noteExpiresAt: number | null;
  /** Condivido la mia posizione? */
  shareMine: boolean;
  myLatE2: number | null;
  myLonE2: number | null;
  myLocAt: number | null;
  /** ok | hidden | mine_off | none | "" (non collegati) */
  partnerLocState: string;
  partnerLatE2: number | null;
  partnerLonE2: number | null;
  partnerLocAt: number | null;
  /** Percorso B: URL del progetto Supabase, chiave PUBBLICA e token del widget (mai la service_role). Vuoti = niente rete. */
  feedUrl: string;
  feedKey: string;
  feedToken: string;
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
  /** Il pet come lo vede questo telefono (con le cure in coda). Facoltativo: senza, il widget mostra l'uovo. */
  pet?: PetState | null;
  myUserId?: string | null;
  /** Il biglietto come lo vede questo telefono (con quelli in coda). */
  note?: Note | null;
  loc?: LocationState | null;
  /** Accesso del widget al feed (Percorso B). */
  feed?: { url: string; key: string; token: string } | null;
};

const CARE_KINDS = ["feed", "cuddle", "play", "sleep", "hatch"];

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
    ...petFields(paired ? (s.pet ?? null) : null, paired, s.myUserId ?? null),
    ...noteFields(s, now),
    ...locFields(s, paired),
    feedUrl: s.feed && s.coupleId ? s.feed.url : "",
    feedKey: s.feed && s.coupleId ? s.feed.key : "",
    feedToken: s.feed && s.coupleId ? s.feed.token : "",
  };
}

function noteFields(
  s: WidgetSource,
  now: number,
): Pick<
  WidgetSnapshot,
  "noteId" | "noteKind" | "noteContent" | "noteBy" | "noteByName" | "noteAt" | "noteExpiresAt"
> {
  const n = s.coupleId ? (s.note ?? null) : null;
  // pulito o già scaduto = nessun biglietto (il widget non deve nemmeno saperlo)
  if (!n || noteState(n, now) !== "active")
    return { noteId: "", noteKind: "", noteContent: null, noteBy: "", noteByName: "", noteAt: null, noteExpiresAt: null };
  return {
    noteId: n.id,
    noteKind: n.kind,
    noteContent: n.content,
    noteBy: n.by,
    noteByName: n.byName,
    noteAt: n.createdAt,
    noteExpiresAt: n.expiresAt,
  };
}

function locFields(
  s: WidgetSource,
  paired: boolean,
): Pick<
  WidgetSnapshot,
  | "shareMine"
  | "myLatE2"
  | "myLonE2"
  | "myLocAt"
  | "partnerLocState"
  | "partnerLatE2"
  | "partnerLonE2"
  | "partnerLocAt"
> {
  const l = s.coupleId ? (s.loc ?? null) : null;
  const p = paired ? (l?.partner ?? null) : null;
  return {
    shareMine: !!l?.sharing,
    myLatE2: l?.sharing && l.me ? l.me.latE2 : null,
    myLonE2: l?.sharing && l.me ? l.me.lonE2 : null,
    myLocAt: l?.sharing && l.me ? l.me.at : null,
    partnerLocState: p ? p.state : "",
    partnerLatE2: p?.state === "ok" ? p.latE2 : null,
    partnerLonE2: p?.state === "ok" ? p.lonE2 : null,
    partnerLocAt: p?.state === "ok" ? p.at : null,
  };
}

function petFields(
  pet: PetState | null,
  paired: boolean,
  me: string | null,
): Pick<
  WidgetSnapshot,
  | "petHatched"
  | "petStage"
  | "petName"
  | "petFood"
  | "petLove"
  | "petEnergy"
  | "petAt"
  | "petSleepUntil"
  | "petLastAt"
  | "petDay"
  | "petBoth"
  | "petLastBy"
  | "petLastKind"
  | "petLastItem"
> {
  const p = pet;
  const hatched = !!p && p.hatchedAt !== null;
  const kind = p?.lastKind && CARE_KINDS.includes(p.lastKind) ? p.lastKind : "";
  return {
    petHatched: hatched,
    petStage: !paired ? "" : p ? stageOf(p) : "egg",
    petName: p?.name ?? "",
    petFood: p?.food ?? 0,
    petLove: p?.love ?? 0,
    petEnergy: p?.energy ?? 0,
    petAt: hatched && p ? p.at : null,
    petSleepUntil: hatched && p ? p.sleepUntil : 0,
    petLastAt: hatched && p && p.lastAt > 0 ? p.lastAt : null,
    petDay: hatched && p?.day ? p.day : "",
    petBoth: hatched && !!p && p.dayA && p.dayB,
    petLastBy: kind && p?.lastBy ? (p.lastBy === me ? "me" : "partner") : "",
    petLastKind: kind,
    petLastItem: kind === "feed" && p?.lastItem ? p.lastItem : "",
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
  "petHatched",
  "petStage",
  "petName",
  "petFood",
  "petLove",
  "petEnergy",
  "petAt",
  "petSleepUntil",
  "petLastAt",
  "petDay",
  "petBoth",
  "petLastBy",
  "petLastKind",
  "petLastItem",
  "noteId",
  "noteKind",
  "noteContent",
  "noteBy",
  "noteByName",
  "noteAt",
  "noteExpiresAt",
  "shareMine",
  "myLatE2",
  "myLonE2",
  "myLocAt",
  "partnerLocState",
  "partnerLatE2",
  "partnerLonE2",
  "partnerLocAt",
  "feedUrl",
  "feedKey",
  "feedToken",
];

/** JSON con l'ordine delle chiavi fisso (diff leggibili, firma stabile). */
export function encodeSnapshot(snap: WidgetSnapshot): string {
  const o: Record<string, unknown> = {};
  for (const k of KEYS) o[k] = snap[k];
  return JSON.stringify(o);
}

/** Legge un payload (anche vecchio, v1-v4, o incompleto) senza mai lanciare. Restituisce null se illeggibile. */
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
      petHatched: o.petHatched === true,
      petStage: str(o.petStage) ?? "",
      petName: str(o.petName) ?? "",
      petFood: num(o.petFood) ?? 0,
      petLove: num(o.petLove) ?? 0,
      petEnergy: num(o.petEnergy) ?? 0,
      petAt: num(o.petAt),
      petSleepUntil: num(o.petSleepUntil) ?? 0,
      petLastAt: num(o.petLastAt),
      petDay: str(o.petDay) ?? "",
      petBoth: o.petBoth === true,
      petLastBy: str(o.petLastBy) ?? "",
      petLastKind: str(o.petLastKind) ?? "",
      petLastItem: str(o.petLastItem) ?? "",
      noteId: str(o.noteId) ?? "",
      noteKind: str(o.noteKind) ?? "",
      noteContent:
        o.noteContent && typeof o.noteContent === "object" ? (o.noteContent as NoteContent) : null,
      noteBy: str(o.noteBy) ?? "",
      noteByName: str(o.noteByName) ?? "",
      noteAt: num(o.noteAt),
      noteExpiresAt: num(o.noteExpiresAt),
      shareMine: o.shareMine === true,
      myLatE2: num(o.myLatE2),
      myLonE2: num(o.myLonE2),
      myLocAt: num(o.myLocAt),
      partnerLocState: str(o.partnerLocState) ?? "",
      partnerLatE2: num(o.partnerLatE2),
      partnerLonE2: num(o.partnerLonE2),
      partnerLocAt: num(o.partnerLocAt),
      feedUrl: str(o.feedUrl) ?? "",
      feedKey: str(o.feedKey) ?? "",
      feedToken: str(o.feedToken) ?? "",
    };
  } catch {
    return null;
  }
}

/** Firma del contenuto senza `updatedAt`: serve a non riscrivere il widget se non è cambiato nulla. */
export function snapshotSignature(snap: WidgetSnapshot): string {
  return encodeSnapshot({ ...snap, updatedAt: 0 });
}
