import { diffDaysIso, localDayKey, monthName } from "@/lib/time";

/**
 * Scadenza dell'app con un Apple ID gratuito (7 giorni dalla firma). La data viene dal provisioning profile
 * embedded (modulo nativo `GroupResolver.expirationDate()`); qui ci sono solo funzioni PURE, provate in
 * tests/expiry.test.ts. Specchio Swift per il widget: `renewLastDay`/`effectiveExpiry` in targets/widget/Model.swift.
 */
export const DAY_MS = 86_400_000;
/** Nell'ultimo giorno (meno di 24 ore alla scadenza) il widget mostra "rinnovami". */
export const RENEW_LAST_MS = DAY_MS;
/** La Home mostra l'adesivo gentile quando mancano al massimo 2 giorni di calendario. */
export const NUDGE_DAYS = 2;
/** Una data di scadenza fuori da questa finestra non è credibile (orologio sballato o profilo strano): si ignora. */
const MIN_PLAUSIBLE = Date.UTC(2020, 0, 1);
const MAX_PLAUSIBLE = Date.UTC(2100, 0, 1);

const WEEKDAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/** `null` se il valore non è una data ragionevole in millisecondi. */
export function cleanExpiry(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= MIN_PLAUSIBLE && v <= MAX_PLAUSIBLE
    ? Math.round(v)
    : null;
}

/** Fra due scadenze (profilo del widget e snapshot) vale la più lontana: un rinnovo sposta la data solo in avanti. */
export function effectiveExpiry(own: number | null | undefined, snap: number | null | undefined): number | null {
  const a = cleanExpiry(own);
  const b = cleanExpiry(snap);
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

export type ExpiryState = "none" | "ok" | "soon" | "last" | "expired";

export type ExpiryView = {
  state: ExpiryState;
  /** Giorni di calendario (fuso del telefono) da oggi al giorno di scadenza; 0 = oggi, negativo = già scaduta. */
  days: number;
  /** "venerdì 28" */
  dayLabel: string;
  /** "28 novembre" */
  dateLabel: string;
};

export function expiryView(expiresAtMs: number | null | undefined, now: number): ExpiryView {
  const at = cleanExpiry(expiresAtMs);
  if (at === null) return { state: "none", days: 0, dayLabel: "", dateLabel: "" };
  const d = new Date(at);
  const days = diffDaysIso(localDayKey(new Date(now)), localDayKey(d));
  const dayLabel = `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
  const dateLabel = `${d.getDate()} ${monthName(d.getMonth() + 1)}`;
  let state: ExpiryState;
  if (at <= now) state = "expired";
  else if (at - now <= RENEW_LAST_MS) state = "last";
  else if (days <= NUDGE_DAYS) state = "soon";
  else state = "ok";
  return { state, days, dayLabel, dateLabel };
}

/** Quando il widget deve avere una voce in più: l'istante in cui entra l'ultimo giorno (se nel futuro e vicino). */
export function renewTimelineMs(expiresAtMs: number | null | undefined, now: number, horizonMs = DAY_MS): number | null {
  const at = cleanExpiry(expiresAtMs);
  if (at === null) return null;
  const t = at - RENEW_LAST_MS;
  return t > now && t <= now + horizonMs ? t : null;
}
