/**
 * Giorni interi tra due date di calendario (AAAA-MM-GG). Si calcola sul calendario (UTC dei componenti), mai
 * sottraendo istanti locali: così il cambio dell'ora legale (23 o 25 ore in un giorno) non sposta il conteggio.
 */
export function daysBetweenIso(startIso: string, todayIso: string): number {
  const a = parseIso(startIso);
  const b = parseIso(todayIso);
  if (!a || !b) return 0;
  return Math.max(
    0,
    Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000),
  );
}

function parseIso(iso: string | null | undefined): [number, number, number] | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return [y, m, d];
}

/** Giorno di calendario del fuso del telefono, AAAA-MM-GG. */
export function localDayKey(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Mezzanotte locale (ms) del giorno di `now`. */
export function localDayStartMs(now: Date = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Giorni interi trascorsi dalla data (AAAA-MM-GG) a oggi, mai negativi; 0 se la data manca. */
export function daysSince(isoDate: string | null | undefined, now: Date = new Date()): number {
  if (!isoDate) return 0;
  return daysBetweenIso(isoDate, localDayKey(now));
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export function monthName(m: number): string {
  return MONTHS[(m - 1 + 12) % 12] ?? "";
}

/** "14 febbraio 2025" */
export function formatLongDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${monthName(m)} ${y}`;
}

/** "adesso", "3 min fa", "2 h fa", "ieri", "5 giorni fa". */
export function timeAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "adesso";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.round(h / 24);
  return d === 1 ? "ieri" : `${d} giorni fa`;
}

// ---------- Giorno "della coppia": Europe/Rome per entrambi ----------
// Calcolato a mano (ora legale UE: dall'ultima domenica di marzo alle 01:00 UTC all'ultima di ottobre alle 01:00 UTC), senza
// `Intl`: sul telefono e nel browser dà lo stesso risultato e non dipende dal fuso del dispositivo. Lo specchio SQL è `_rome_day()`.
function lastSundayUtc(y: number, month0: number): number {
  const last = new Date(Date.UTC(y, month0 + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** Scarto di Roma rispetto a UTC in minuti (60 inverno, 120 estate). */
export function romeOffsetMin(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  const start = Date.UTC(y, 2, lastSundayUtc(y, 2), 1, 0, 0);
  const end = Date.UTC(y, 9, lastSundayUtc(y, 9), 1, 0, 0);
  return utcMs >= start && utcMs < end ? 120 : 60;
}

/** Giorno di calendario a Roma (AAAA-MM-GG) nell'istante `utcMs`. */
export function romeDayKey(utcMs: number = Date.now()): string {
  const d = new Date(utcMs + romeOffsetMin(utcMs) * 60_000);
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Il giorno dopo (AAAA-MM-GG). */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y || 1970, (m || 1) - 1, (d || 1) + n));
  return toIso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Giorni dal 1970-01-01 a una data di calendario (AAAA-MM-GG). */
export function epochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Differenza in giorni (b - a), anche negativa. */
export function diffDaysIso(aIso: string, bIso: string): number {
  return epochDay(bIso) - epochDay(aIso);
}
