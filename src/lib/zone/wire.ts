import { emptyZSnapshot, type ZEntry, type ZIdea, type ZSignal, type ZSnapshot, type ZVoucher } from "./types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const sig = (v: unknown): ZSignal | null => {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const level = num(o.level);
  const at = num(o.at);
  const expiresAt = num(o.expiresAt);
  return level && at !== null && expiresAt !== null && level >= 1 && level <= 3 ? { level: level as 1 | 2 | 3, at, expiresAt } : null;
};

/** Legge la risposta di `z_get` (anche incompleta o di un server vecchio) senza mai lanciare. */
export function zoneSnapshotFromJson(j: unknown): ZSnapshot {
  const s = emptyZSnapshot();
  if (!j || typeof j !== "object") return s;
  const o = j as Record<string, unknown>;
  s.now = num(o.now) ?? 0;
  s.today = str(o.today) ?? "";
  s.pulse = num(o.pulse) ?? 0;
  s.entries = arr(o.entries).flatMap((e): ZEntry[] => {
    const id = str(e.id);
    const day = str(e.day);
    if (!id || !day) return [];
    const by = e.by === "a" || e.by === "b" ? e.by : null;
    return [{ id, day, at: num(e.at) ?? 0, place: (str(e.place) as ZEntry["place"]) ?? null, starter: (str(e.starter) as ZEntry["starter"]) ?? null, rating: num(e.rating), note: str(e.note), by, updatedAt: num(e.updatedAt) ?? 0 }];
  });
  s.customIdeas = arr(o.ideas).flatMap((i): ZIdea[] => {
    const id = str(i.id);
    const text = str(i.text);
    const level = str(i.level);
    return id && text && (level === "dolce" || level === "piccante" || level === "audace") ? [{ id, text, level, mine: i.mine === true }] : [];
  });
  s.wishesMine = strs(o.wishesMine);
  s.matches = strs(o.matches);
  const t = (o.tonight ?? {}) as Record<string, unknown>;
  const mine = str(t.mine);
  const result = str(t.result);
  s.tonight = {
    day: str(t.day) ?? "",
    mine: mine === "yes" || mine === "maybe" || mine === "no" ? mine : null,
    otherAnswered: t.otherAnswered === true,
    result: result === "match" || result === "nomatch" ? result : null,
  };
  const g = (o.signal ?? {}) as Record<string, unknown>;
  s.signal = { incoming: sig(g.incoming), mine: sig(g.mine) };
  s.vouchers = arr(o.vouchers).flatMap((v): ZVoucher[] => {
    const id = str(v.id);
    const title = str(v.title);
    return id && title ? [{ id, title, expires: str(v.expires), redeemedAt: num(v.redeemedAt), createdAt: num(v.createdAt) ?? 0, fromMe: v.fromMe === true }] : [];
  });
  return s;
}
