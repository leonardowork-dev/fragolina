/**
 * Prossima ricorrenza della coppia, calcolata SOLO da `startDate` (AAAA-MM-GG) e dal giorno di oggi.
 * Il widget Swift (targets/widget/Recurrence.swift) implementa la STESSA regola con la stessa aritmetica intera
 * sul calendario (niente Date/ora legale): tests/recurrence.test.ts fissa i casi e tests/fixtures/recurrence-cases.json
 * è la tabella di verità condivisa anche con la prova Swift (scripts/swift-check.mjs).
 *
 * Regole (annotate in DECISIONS.md):
 * - Mesiversario: stesso giorno del mese, ogni mese dal 1°. Se il mese non ha quel giorno (31 gennaio → febbraio),
 *   cade sull'ULTIMO giorno del mese (28 o 29 febbraio, 30 aprile…). Il conteggio parte sempre dalla data vera
 *   (non da quella già "tagliata"), quindi il 31 gennaio dà 28 feb, 31 mar, 30 apr, 31 mag.
 * - 12, 24, 36… mesi = anniversario ("1 anno", "2 anni"); gli altri sopra l'anno: "1 anno e 3 mesi".
 * - Giorni: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, poi ogni 500 (1500, 2000, …). Il 365° giorno non è
 *   un traguardo a parte: l'anniversario di calendario lo copre (evita due feste a un giorno di distanza).
 * - Se nello stesso giorno cadono più cose vince: anniversario > giorni > mesi.
 * - Oggi conta ("daysUntil" = 0 → festa). Data d'inizio nel futuro o assente → nessuna ricorrenza.
 */
export type RecurrenceKind = "month" | "year" | "days";

export type Recurrence = {
  /** Data della ricorrenza (AAAA-MM-GG). */
  date: string;
  /** Giorni da oggi (0 = oggi). */
  daysUntil: number;
  kind: RecurrenceKind;
  /** Quanti: mesi (1-11), anni (1, 2, …) o giorni (100, 200, …). */
  count: number;
  /** "6 mesi", "1 anno", "100 giorni". */
  label: string;
};

type Ymd = [number, number, number];

export function parseYmd(iso: string | null | undefined): Ymd | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonthYmd(y, mo)) return null;
  return [y, mo, d];
}

export function daysInMonthYmd(y: number, m: number): number {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** Giorni dal 1970-01-01 (algoritmo di Howard Hinnant, solo interi). */
export function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function civilFromDays(z0: number): Ymd {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [m <= 2 ? y + 1 : y, m, d];
}

const iso = ([y, m, d]: Ymd) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Mesiversario numero `k` (k ≥ 1), con il giorno ridotto all'ultimo del mese se serve. */
export function monthsary(start: Ymd, k: number): Ymd {
  const total = start[0] * 12 + (start[1] - 1) + k;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return [y, m, Math.min(start[2], daysInMonthYmd(y, m))];
}

/** Il prossimo traguardo in giorni strettamente maggiore o uguale a `n` (n = giorni già passati). */
export function nextDayMilestone(n: number): number {
  if (n <= 100) return 100;
  if (n <= 1000) return Math.ceil(n / 100) * 100;
  return Math.ceil(n / 500) * 500;
}

export function monthsLabel(k: number): { kind: RecurrenceKind; count: number; label: string } {
  const years = Math.floor(k / 12);
  const rem = k % 12;
  const y = years === 1 ? "1 anno" : `${years} anni`;
  const m = rem === 1 ? "1 mese" : `${rem} mesi`;
  if (rem === 0) return { kind: "year", count: years, label: y };
  return { kind: "month", count: k, label: years === 0 ? m : `${y} e ${m}` };
}

export function nextRecurrence(startIso: string | null | undefined, todayIso: string): Recurrence | null {
  const start = parseYmd(startIso);
  const today = parseYmd(todayIso);
  if (!start || !today) return null;
  const startDay = daysFromCivil(...start);
  const todayDay = daysFromCivil(...today);
  const elapsed = todayDay - startDay;
  if (elapsed < 0) return null;

  // prossimo mesiversario (oggi incluso)
  let k = Math.max(1, (today[0] - start[0]) * 12 + (today[1] - start[1]));
  while (daysFromCivil(...monthsary(start, k)) < todayDay) k += 1;
  const mDay = daysFromCivil(...monthsary(start, k));
  const month = { day: mDay, ...monthsLabel(k) };

  // prossimo traguardo in giorni (oggi incluso). Il giorno 0 non è un traguardo.
  const target = nextDayMilestone(elapsed);
  const dayEv = { day: startDay + target, kind: "days" as RecurrenceKind, count: target, label: `${target} giorni` };

  const rank = (e: { day: number; kind: RecurrenceKind }) => [e.day, e.kind === "year" ? 0 : e.kind === "days" ? 1 : 2];
  const best = [month, dayEv].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1];
  })[0];
  return {
    date: iso(civilFromDays(best.day)),
    daysUntil: best.day - todayDay,
    kind: best.kind,
    count: best.count,
    label: best.label,
  };
}

/** Giorni interi dalla data d'inizio a oggi (≥ 0), o null se manca la data. Stessa regola di daysBetweenIso. */
export function daysTogether(startIso: string | null | undefined, todayIso: string): number | null {
  const start = parseYmd(startIso);
  const today = parseYmd(todayIso);
  if (!start || !today) return null;
  return Math.max(0, daysFromCivil(...today) - daysFromCivil(...start));
}

/** "tra 12 giorni", "domani", "oggi" */
export function untilText(daysUntil: number): string {
  if (daysUntil <= 0) return "oggi";
  if (daysUntil === 1) return "domani";
  return `tra ${daysUntil} giorni`;
}

const MONTH_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "14 mag" (stessa forma di `shortDate` in Model.swift). */
export function shortDateYmd(isoDate: string): string {
  const p = parseYmd(isoDate);
  return p ? `${p[2]} ${MONTH_SHORT[p[1] - 1]}` : "";
}
