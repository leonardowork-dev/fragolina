import { addDaysIso, diffDaysIso } from "@/lib/time";

import { PLACES, type Place, type ZEntry } from "./types";

/** Quanti cuoricini disegnare per un giorno: fino a 5 uno per volta; oltre, un cuore grande con "×N". */
export function heartsFor(count: number): { small: number; big: number | null } {
  if (count <= 0) return { small: 0, big: null };
  if (count <= 5) return { small: count, big: null };
  return { small: 0, big: count };
}

export function countsByDay(entries: readonly ZEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.day, (m.get(e.day) ?? 0) + 1);
  return m;
}

const dowMon = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7; // 0 = lunedì
};

/** Griglia del mese (settimane da lunedì): `null` = cella vuota. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const n = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: dowMon(first) }, () => null);
  for (let d = 1; d <= n; d++) cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export type ZStats = {
  total: number;
  thisMonth: number;
  recordDay: { day: string; count: number } | null;
  hottestWeek: { start: string; count: number } | null;
  /** Giorni di fila (con almeno una volta) che arrivano a oggi o a ieri. */
  streak: number;
  bestStreak: number;
  favoritePlace: Place | null;
  avgRating: number | null;
  /** Chi inizia più spesso, dal punto di vista di chi guarda (`me` = il ruolo di questo telefono). */
  starter: { me: number; you: number; both: number };
};

export function zoneStats(entries: readonly ZEntry[], today: string, myRole: "a" | "b" | null): ZStats {
  const counts = countsByDay(entries);
  let record: ZStats["recordDay"] = null;
  for (const [day, count] of counts) if (!record || count > record.count || (count === record.count && day > record.day)) record = { day, count };
  const weeks = new Map<string, number>();
  for (const [day, c] of counts) {
    const start = addDaysIso(day, -dowMon(day));
    weeks.set(start, (weeks.get(start) ?? 0) + c);
  }
  let hot: ZStats["hottestWeek"] = null;
  for (const [start, count] of weeks) if (!hot || count > hot.count || (count === hot.count && start > hot.start)) hot = { start, count };
  const days = [...counts.keys()].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && diffDaysIso(days[i - 1]!, days[i]!) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let streak = 0;
  let cur = counts.has(today) ? today : addDaysIso(today, -1);
  while (counts.has(cur)) {
    streak++;
    cur = addDaysIso(cur, -1);
  }
  const placeCount = new Map<Place, number>();
  for (const e of entries) if (e.place) placeCount.set(e.place, (placeCount.get(e.place) ?? 0) + 1);
  let fav: Place | null = null;
  for (const [p, c] of placeCount) if (!fav || c > (placeCount.get(fav) ?? 0)) fav = p;
  const rated = entries.filter((e) => e.rating !== null);
  const avg = rated.length ? Math.round((rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  const starter = { me: 0, you: 0, both: 0 };
  for (const e of entries) {
    if (e.starter === "both") starter.both++;
    else if (e.starter && myRole) {
      if (e.starter === myRole) starter.me++;
      else starter.you++;
    }
  }
  return {
    total: entries.length,
    thisMonth: entries.filter((e) => e.day.slice(0, 7) === today.slice(0, 7)).length,
    recordDay: record,
    hottestWeek: hot,
    streak,
    bestStreak: best,
    favoritePlace: fav,
    avgRating: avg,
    starter,
  };
}

export type MilestoneId = "first" | "t10" | "t50" | "t100" | "t200" | "five_day" | "all_rooms" | "streak3" | "streak7";
export const MILESTONE_IDS: readonly MilestoneId[] = ["first", "t10", "t50", "t100", "t200", "five_day", "all_rooms", "streak3", "streak7"];

/** Traguardi raggiunti (stessa funzione prima e dopo un +1: la differenza dice quale è appena scattato). */
export function milestones(entries: readonly ZEntry[], today: string): Set<MilestoneId> {
  const s = zoneStats(entries, today, null);
  const out = new Set<MilestoneId>();
  if (s.total >= 1) out.add("first");
  if (s.total >= 10) out.add("t10");
  if (s.total >= 50) out.add("t50");
  if (s.total >= 100) out.add("t100");
  if (s.total >= 200) out.add("t200");
  if ((s.recordDay?.count ?? 0) >= 5) out.add("five_day");
  const named = PLACES.filter((p) => p !== "altro");
  const seen = new Set(entries.map((e) => e.place));
  if (named.every((p) => seen.has(p))) out.add("all_rooms");
  if (s.bestStreak >= 3) out.add("streak3");
  if (s.bestStreak >= 7) out.add("streak7");
  return out;
}

export const newMilestone = (before: ReadonlySet<MilestoneId>, after: ReadonlySet<MilestoneId>): MilestoneId | null =>
  MILESTONE_IDS.find((m) => after.has(m) && !before.has(m)) ?? null;
