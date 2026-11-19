import { hashString } from "@/lib/hash";
import { addDaysIso, epochDay } from "@/lib/time";

import { BANK, bankQuestion } from "./bank";

/**
 * Domanda del giorno vera. Funzioni PURE. Specchio SQL: `answer_qa`, `set_tomorrow_question`, `get_qa` (limiti, turni).
 * Il "giorno" è quello di Roma per entrambi (src/lib/time.ts: `romeDayKey`).
 */
export const ANSWER_MAX = 280;
export const TOMORROW_MIN = 3;
export const TOMORROW_MAX = 140;

export const cleanAnswer = (t: string) => t.trim().slice(0, ANSWER_MAX);
export const cleanQuestion = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, TOMORROW_MAX);

/** Id di una domanda della versione base (a/b): `q-sabato` → `l-sabato`. Specchio della migrazione SQL. */
export const legacyRef = (oldId: string) => "l-" + oldId.replace(/^q-/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 38);

/**
 * La domanda di un giorno: ordine deterministico PER COPPIA (si ordina il mazzo per un hash di coppia+domanda) e
 * posizione = numero del giorno modulo la dimensione del mazzo → entrambi i telefoni scelgono la stessa e non si ripete
 * per tutto il mazzo (più di un anno). Il primo che apre il giorno la fissa sul server: poi vale quella.
 */
const orderCache = new Map<string, string[]>();
export function orderFor(coupleId: string): string[] {
  const hit = orderCache.get(coupleId);
  if (hit) return hit;
  const ids = BANK.map((q) => q.id).sort((a, b) => {
    const ha = hashString(`${coupleId}|${a}`);
    const hb = hashString(`${coupleId}|${b}`);
    return ha !== hb ? ha - hb : a < b ? -1 : 1;
  });
  orderCache.set(coupleId, ids);
  return ids;
}

export function questionRefForDay(coupleId: string, day: string): string {
  const ids = orderFor(coupleId);
  const n = epochDay(day);
  return ids[((n % ids.length) + ids.length) % ids.length]!;
}

/** Chi scrive la domanda di domani: ruolo `a` se il numero del giorno di domani è pari, `b` se dispari (specchio SQL). */
export function tomorrowAuthorRole(today: string): "a" | "b" {
  return epochDay(addDaysIso(today, 1)) % 2 === 0 ? "a" : "b";
}

export type QaAnswer = { text: string; choice: "a" | "b" | null; at: number };
/** Un giorno visto da chi guarda. `theirs` c'è solo se hanno risposto entrambi (il server lo manda solo dopo la tua risposta). */
export type QaDay = {
  day: string;
  ref: string;
  custom: string | null;
  setBy: string | null;
  mine: QaAnswer | null;
  theirsAnswered: boolean;
  theirs: QaAnswer | null;
};

export type QaSnapshot = { today: string; tomorrow: string; tomorrowTurn: boolean; days: QaDay[] };

/** Testo della domanda di un giorno (mazzo, scritta da uno dei due, o della versione base). */
export function questionText(d: Pick<QaDay, "ref" | "custom">, legacy: (ref: string) => string | null): string {
  if (d.custom) return d.custom;
  const b = bankQuestion(d.ref);
  if (b) return b.text;
  return legacy(d.ref) ?? "";
}

/** Minuscole, senza accenti: per cercare "mare" e trovare "Mare" e "màre". */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Archivio: i giorni passati in cui HAI risposto (mai un elenco di cose che non hai fatto), dal più recente. Con `query`
 * solo quelli in cui la parola compare nella domanda o in una delle risposte. Cerca anche pezzi di parola.
 */
export function archiveOf(
  days: readonly QaDay[],
  today: string,
  textOf: (d: QaDay) => string,
  query = "",
  legacyChoice: (d: QaDay, choice: "a" | "b") => string = () => "",
): QaDay[] {
  const q = norm(query.trim());
  return days
    .filter((d) => d.day < today && d.mine !== null)
    .filter((d) => {
      if (!q) return true;
      const hay = [
        textOf(d),
        d.mine?.text ?? "",
        d.theirs?.text ?? "",
        d.mine?.choice ? legacyChoice(d, d.mine.choice) : "",
        d.theirs?.choice ? legacyChoice(d, d.theirs.choice) : "",
      ];
      return hay.some((t) => norm(t).includes(q));
    })
    .sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function qaDayFromJson(x: unknown): QaDay | null {
  if (!x || typeof x !== "object") return null;
  const j = x as Record<string, unknown>;
  if (typeof j.day !== "string" || typeof j.ref !== "string") return null;
  const ans = (a: unknown): QaAnswer | null => {
    if (!a || typeof a !== "object") return null;
    const o = a as Record<string, unknown>;
    return {
      text: typeof o.text === "string" ? o.text : "",
      choice: o.choice === "a" || o.choice === "b" ? o.choice : null,
      at: typeof o.at === "number" ? o.at : 0,
    };
  };
  return {
    day: j.day,
    ref: j.ref,
    custom: typeof j.custom === "string" ? j.custom : null,
    setBy: typeof j.setBy === "string" ? j.setBy : null,
    mine: ans(j.mine),
    theirsAnswered: j.theirsAnswered === true,
    theirs: ans(j.theirs),
  };
}

export function qaSnapshotFromJson(d: unknown): QaSnapshot | null {
  if (!d || typeof d !== "object") return null;
  const j = d as Record<string, unknown>;
  if (typeof j.today !== "string" || typeof j.tomorrow !== "string") return null;
  const days = (Array.isArray(j.days) ? j.days : []).map(qaDayFromJson).filter((x): x is QaDay => x !== null);
  return { today: j.today, tomorrow: j.tomorrow, tomorrowTurn: j.tomorrowTurn === true, days };
}
