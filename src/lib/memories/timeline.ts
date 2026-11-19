import { type CountdownEvent, pastEvents } from "@/lib/countdown/rules";
import type { QaDay } from "@/lib/qa/rules";
import { civilFromDays, daysFromCivil, monthsary, parseYmd } from "@/lib/recurrence";

import type { Memory } from "./types";

/**
 * L'album: una timeline per mese che mette insieme foto, biglietti e disegni tenuti, eventi passati del conto alla
 * rovescia, risposte rivelate della domanda del giorno e traguardi di "giorni insieme". Funzioni PURE.
 */
export type TimelineItem =
  | { type: "memory"; day: string; sort: number; memory: Memory }
  | { type: "event"; day: string; sort: number; event: CountdownEvent }
  | { type: "qa"; day: string; sort: number; qa: QaDay }
  | { type: "milestone"; day: string; sort: number; label: string };

export type TimelineMonth = { key: string; year: number; month: number; items: TimelineItem[] };

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Traguardi di "giorni insieme" già raggiunti: 100, 200… 1000, poi ogni 500; anniversari; 6 mesi, 18 mesi… */
export function milestonesUntil(startIso: string | null, todayIso: string): { day: string; label: string }[] {
  const start = parseYmd(startIso);
  const today = parseYmd(todayIso);
  if (!start || !today) return [];
  const startDay = daysFromCivil(...start);
  const todayDay = daysFromCivil(...today);
  const out: { day: string; label: string }[] = [];
  const add = (dn: number, label: string) => {
    if (dn <= todayDay && dn >= startDay) out.push({ day: iso(...civilFromDays(dn)), label });
  };
  for (let n = 100; startDay + n <= todayDay; n += n < 1000 ? 100 : 500) add(startDay + n, `${n} giorni insieme`);
  for (let k = 6; ; k += 6) {
    const dn = daysFromCivil(...monthsary(start, k));
    if (dn > todayDay) break;
    add(dn, k % 12 === 0 ? (k === 12 ? "1 anno insieme" : `${k / 12} anni insieme`) : `${k} mesi insieme`);
  }
  return out;
}

export function buildTimeline(a: {
  memories: readonly Memory[];
  events: readonly CountdownEvent[];
  qa: readonly QaDay[];
  startDate: string | null;
  today: string;
  nowMin: number;
}): TimelineMonth[] {
  const items: TimelineItem[] = [];
  a.memories.forEach((m, i) => items.push({ type: "memory", day: m.day, sort: 1000 + (m.createdAt || i), memory: m }));
  for (const e of pastEvents(a.events, a.today, a.nowMin)) items.push({ type: "event", day: e.date, sort: 500, event: e });
  for (const q of a.qa) if (q.mine && q.theirs && q.day <= a.today) items.push({ type: "qa", day: q.day, sort: 300, qa: q });
  for (const m of milestonesUntil(a.startDate, a.today)) items.push({ type: "milestone", day: m.day, sort: 100, label: m.label });
  const byMonth = new Map<string, TimelineItem[]>();
  for (const it of items) {
    const k = it.day.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), it]);
  }
  return [...byMonth.entries()]
    .sort((x, y) => (x[0] < y[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      items: list.sort((p, q) => (p.day !== q.day ? (p.day < q.day ? 1 : -1) : q.sort - p.sort)),
    }));
}

export type YearAgo = { yearsAgo: number; item: TimelineItem };

/** "Un anno fa oggi": ciò che è successo nello stesso giorno e mese di anni passati (silenzio se non c'è niente). */
export function yearsAgoToday(timeline: readonly TimelineMonth[], today: string): YearAgo[] {
  const md = today.slice(5);
  const y = Number(today.slice(0, 4));
  const out: YearAgo[] = [];
  for (const m of timeline)
    for (const it of m.items) {
      if (it.type === "milestone") continue;
      if (it.day.slice(5) === md && Number(it.day.slice(0, 4)) < y) out.push({ yearsAgo: y - Number(it.day.slice(0, 4)), item: it });
    }
  return out.sort((p, q) => p.yearsAgo - q.yearsAgo);
}
