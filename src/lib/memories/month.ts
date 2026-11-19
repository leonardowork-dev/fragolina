import type { MoodId } from "@/features/home/moods";

/** "Il nostro mese": cosa torna dal server (`get_month`) e come si legge. */
export type MonthRaw = {
  year: number;
  month: number;
  moods: { u: string; d: string; m: MoodId }[];
  pings: Record<string, number>;
  games: Record<string, number>;
  qaBoth: number;
};

export type MonthView = {
  year: number;
  month: number;
  daysInMonth: number;
  /** Per ogni giorno del mese l'umore di ciascuno (null = nessuno quel giorno). */
  days: { day: number; mine: MoodId | null; theirs: MoodId | null }[];
  /** L'umore più frequente di ciascuno (null se mai scelto). */
  topMine: { mood: MoodId; n: number } | null;
  topTheirs: { mood: MoodId; n: number } | null;
  pingsMine: number;
  pingsTheirs: number;
  games: number;
  qaBoth: number;
};

const top = (xs: MoodId[]): { mood: MoodId; n: number } | null => {
  const c = new Map<MoodId, number>();
  for (const m of xs) c.set(m, (c.get(m) ?? 0) + 1);
  let best: { mood: MoodId; n: number } | null = null;
  for (const [mood, n] of c) if (!best || n > best.n) best = { mood, n };
  return best;
};

export function monthView(raw: MonthRaw, me: string): MonthView {
  const dim = new Date(Date.UTC(raw.year, raw.month, 0)).getUTCDate();
  const days = Array.from({ length: dim }, (_, i) => ({ day: i + 1, mine: null as MoodId | null, theirs: null as MoodId | null }));
  const mineAll: MoodId[] = [];
  const theirsAll: MoodId[] = [];
  for (const e of raw.moods) {
    const dn = Number(e.d.slice(8, 10));
    const slot = days[dn - 1];
    if (!slot) continue;
    if (e.u === me) {
      slot.mine = e.m;
      mineAll.push(e.m);
    } else {
      slot.theirs = e.m;
      theirsAll.push(e.m);
    }
  }
  let pm = 0;
  let pt = 0;
  for (const [u, n] of Object.entries(raw.pings)) {
    if (u === me) pm += n;
    else pt += n;
  }
  return {
    year: raw.year,
    month: raw.month,
    daysInMonth: dim,
    days,
    topMine: top(mineAll),
    topTheirs: top(theirsAll),
    pingsMine: pm,
    pingsTheirs: pt,
    games: Object.values(raw.games).reduce((a, b) => a + b, 0),
    qaBoth: raw.qaBoth,
  };
}

export function monthRawFromJson(d: unknown): MonthRaw | null {
  if (!d || typeof d !== "object") return null;
  const j = d as Record<string, unknown>;
  if (typeof j.year !== "number" || typeof j.month !== "number") return null;
  const moods = (Array.isArray(j.moods) ? j.moods : []).filter(
    (x): x is { u: string; d: string; m: MoodId } => !!x && typeof x === "object" && typeof (x as { u: unknown }).u === "string",
  );
  const numMap = (o: unknown): Record<string, number> =>
    o && typeof o === "object" ? Object.fromEntries(Object.entries(o as Record<string, unknown>).filter(([, v]) => typeof v === "number")) as Record<string, number> : {};
  return { year: j.year, month: j.month, moods, pings: numMap(j.pings), games: numMap(j.games), qaBoth: typeof j.qaBoth === "number" ? j.qaBoth : 0 };
}
