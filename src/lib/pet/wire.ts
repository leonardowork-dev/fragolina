import type { FoodId, PetKind, PetState } from "./rules";
import type { PetLogEntry, PetSnapshot } from "./sync";

/** Dal JSON del server (SQL `_pet_json` o riga del tempo reale: stesse chiavi in snake_case) allo stato dell'app. */
const num = (v: unknown, d = 0) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : d;
  return Number.isFinite(n) ? n : d;
};
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);

export function petFromRow(r: Record<string, unknown>): PetState {
  return {
    rev: num(r.rev),
    hatchedAt: r.hatched_at === null || r.hatched_at === undefined ? null : num(r.hatched_at),
    hatchedBy: strOrNull(r.hatched_by),
    touchesA: num(r.touches_a),
    touchesB: num(r.touches_b),
    name: strOrNull(r.name),
    nameAt: num(r.name_at),
    food: num(r.food, 800),
    love: num(r.love, 800),
    energy: num(r.energy, 800),
    at: num(r.at),
    sleepUntil: num(r.sleep_until),
    lastAt: num(r.last_at),
    careDays: num(r.care_days),
    bothDays: num(r.both_days),
    day: strOrNull(r.day),
    dayA: r.day_a === true,
    dayB: r.day_b === true,
    lastBy: strOrNull(r.last_by),
    lastKind: strOrNull(r.last_kind) as PetKind | "hatch" | null,
    lastItem: strOrNull(r.last_item) as FoodId | null,
    lastKey: strOrNull(r.last_key),
  };
}

/** Risposta di `get_pet`. */
export function petSnapshotFromJson(d: {
  pet?: Record<string, unknown> | null;
  log?: Record<string, unknown>[];
  my_last?: Record<string, unknown>;
}): PetSnapshot {
  const log: PetLogEntry[] = (d.log ?? []).map((e) => ({
    rev: num(e.rev),
    key: String(e.key ?? ""),
    userId: String(e.user_id ?? ""),
    kind: String(e.kind) as PetLogEntry["kind"],
    item: strOrNull(e.item) as FoodId | null,
    at: num(e.at),
  }));
  const myLast: PetSnapshot["myLast"] = {};
  for (const [k, v] of Object.entries(d.my_last ?? {})) myLast[k as PetKind] = num(v);
  return { state: d.pet ? petFromRow(d.pet) : null, log, myLast };
}
