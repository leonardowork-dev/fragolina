import { type EventIconId, isEventIcon } from "./icons";

/**
 * Conto alla rovescia ("Manca poco"). Funzioni PURE. Specchio SQL: `upsert_event` (limiti), specchio Swift: `Model.swift`
 * (`countdownView`, `pickCountdown`, `countdownTimelineDates`): il widget calcola da solo i giorni dalla data.
 * La data è una data di calendario (AAAA-MM-GG) e l'ora facoltativa è l'ora del muro del telefono (HH:MM): "tra 12 giorni"
 * vuol dire 12 mezzanotti da adesso, come "Giorni insieme".
 */
export const TITLE_MAX = 28;
export const MAX_EVENTS = 60;
/** Dopo l'ora dell'evento resta la festa per un'ora, poi passa. */
export const PARTY_GRACE_MIN = 60;

export type CountdownEvent = {
  id: string;
  title: string;
  /** AAAA-MM-GG */
  date: string;
  /** HH:MM oppure null (tutto il giorno) */
  time: string | null;
  icon: EventIconId;
  featured: boolean;
  /** Orario logico dell'ultima modifica (ms): last-write-wins. */
  at: number;
  /** Chi ha fatto l'ultima modifica (userId), se il server lo dice. */
  by?: string;
};

export type EventInput = { title: string; date: string; time: string | null; icon: EventIconId; featured: boolean };
export type EventError = "title" | "date" | "time" | "icon";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(iso: string): boolean {
  const m = DATE_RE.exec(iso);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

export const cleanTitle = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);

export function validateEvent(e: EventInput): EventError | null {
  if (cleanTitle(e.title).length < 1) return "title";
  if (!isValidDate(e.date)) return "date";
  if (e.time !== null && !TIME_RE.test(e.time)) return "time";
  if (!isEventIcon(e.icon)) return "icon";
  return null;
}

export function minutesOf(time: string | null): number | null {
  if (!time || !TIME_RE.test(time)) return null;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000);
};

export type CountdownState = "days" | "hours" | "minutes" | "today" | "now" | "passed";
export type CountdownView = {
  state: CountdownState;
  /** Giorni di calendario da oggi (negativo = passato). */
  daysUntil: number;
  /** Il numero grande: giorni, ore o minuti. "" se passato. */
  big: string;
  /** "giorni", "giorno", "ore", "ora", "min", "oggi", "ora!" */
  unit: string;
};

/**
 * Cosa mostrare ADESSO (`today` = AAAA-MM-GG locale, `nowMin` = minuti dalla mezzanotte locale).
 * Giorni fino al giorno prima; nell'ultimo giorno, se c'è l'ora, ore (poi minuti nell'ultima ora); l'ora esatta e per
 * un'ora dopo è "ora!"; senza ora, il giorno stesso è "oggi" (festa). Poi passa.
 */
export function countdownView(e: Pick<CountdownEvent, "date" | "time">, today: string, nowMin: number): CountdownView {
  const daysUntil = dayNumber(e.date) - dayNumber(today);
  if (daysUntil < 0) return { state: "passed", daysUntil, big: "", unit: "" };
  if (daysUntil > 0) return { state: "days", daysUntil, big: String(daysUntil), unit: daysUntil === 1 ? "giorno" : "giorni" };
  const at = minutesOf(e.time);
  if (at === null) return { state: "today", daysUntil: 0, big: "", unit: "oggi" };
  const left = at - nowMin;
  if (left > 60) {
    const h = Math.ceil(left / 60);
    return { state: "hours", daysUntil: 0, big: String(h), unit: h === 1 ? "ora" : "ore" };
  }
  if (left > 0) return { state: "minutes", daysUntil: 0, big: String(left), unit: "min" };
  if (left > -PARTY_GRACE_MIN) return { state: "now", daysUntil: 0, big: "", unit: "ora!" };
  return { state: "passed", daysUntil: 0, big: "", unit: "" };
}

export const isPassed = (e: Pick<CountdownEvent, "date" | "time">, today: string, nowMin: number) =>
  countdownView(e, today, nowMin).state === "passed";

const byDate = (a: CountdownEvent, b: CountdownEvent) =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.time ?? "") < (b.time ?? "") ? -1 : (a.time ?? "") > (b.time ?? "") ? 1 : a.id < b.id ? -1 : 1;

/** L'evento da mettere in primo piano: quello "in evidenza" se non è passato, altrimenti il più vicino. */
export function pickCountdown(events: readonly CountdownEvent[], today: string, nowMin: number): CountdownEvent | null {
  const live = events.filter((e) => !isPassed(e, today, nowMin));
  if (!live.length) return null;
  return live.find((e) => e.featured) ?? [...live].sort(byDate)[0] ?? null;
}

export const upcomingEvents = (events: readonly CountdownEvent[], today: string, nowMin: number) =>
  events.filter((e) => !isPassed(e, today, nowMin)).sort(byDate);
export const pastEvents = (events: readonly CountdownEvent[], today: string, nowMin: number) =>
  events.filter((e) => isPassed(e, today, nowMin)).sort((a, b) => -byDate(a, b));

/** Gli eventi che passano allo snapshot del widget: gli in-evidenza per primo, poi per data, al massimo 5, già "vivi" ieri o dopo. */
export const WIDGET_EVENTS = 5;
export function widgetEvents(events: readonly CountdownEvent[], today: string): CountdownEvent[] {
  const live = events.filter((e) => dayNumber(e.date) >= dayNumber(today) - 1);
  const feat = live.filter((e) => e.featured).sort(byDate);
  const rest = live.filter((e) => !e.featured).sort(byDate);
  return [...feat, ...rest].slice(0, WIDGET_EVENTS);
}

/** "Local" nel senso del telefono: giorno e minuti dell'orologio a muro. */
export function wallClock(d: Date): { today: string; nowMin: number } {
  const p = (n: number) => String(n).padStart(2, "0");
  return { today: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, nowMin: d.getHours() * 60 + d.getMinutes() };
}

/**
 * Istanti (ms) in cui il widget si ridisegna da solo: adesso, le prossime mezzanotti (+10 s), e per l'evento di oggi
 * ogni 30 minuti fino all'ora, l'ora esatta e un'ora dopo (poi passa). `tzOffsetMin` = scarto dell'orologio a muro da UTC
 * (nel widget è quello del telefono; nelle prove è 0). Specchio di `countdownTimelineDates` in Model.swift.
 */
export function countdownTimelineMs(
  event: Pick<CountdownEvent, "date" | "time"> | null,
  nowMs: number,
  tzOffsetMin = 0,
): number[] {
  const out = new Set<number>([nowMs]);
  const off = tzOffsetMin * 60_000;
  const wall = nowMs + off;
  const dayMs = 86_400_000;
  const startOfDay = Math.floor(wall / dayMs) * dayMs;
  for (let i = 1; i <= 3; i++) out.add(startOfDay + i * dayMs + 10_000 - off);
  if (event) {
    const at = minutesOf(event.time);
    const eventDayStart = dayNumber(event.date) * dayMs;
    if (at !== null) {
      const t = eventDayStart + at * 60_000 - off;
      if (t > nowMs - PARTY_GRACE_MIN * 60_000 && t <= nowMs + 3 * dayMs) {
        for (let k = 1; k <= 6; k++) {
          const before = t - k * 30 * 60_000;
          if (before > nowMs) out.add(before);
        }
        if (t > nowMs) out.add(t);
        out.add(t + 1_000);
        out.add(t + PARTY_GRACE_MIN * 60_000 + 1_000);
      }
    }
  }
  return [...out].filter((x) => x >= nowMs).sort((a, b) => a - b);
}
