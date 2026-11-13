/**
 * Regole del pet condiviso. Funzioni PURE, solo interi: gli stessi numeri devono uscire in TypeScript (app e finto
 * server), in SQL (`_pet_step` nella migrazione del pet) e in Swift (`Model.swift`, il widget). I tre sono tenuti
 * allineati da prove con le stesse sequenze (tests/pet*.test.ts, scripts/sql-check.mjs, tests/swiftParity.test.ts).
 *
 * Idee base:
 *  - i bisogni sono tre (pancia, coccole, sonno) da 0 a 1000 e NON sono un timer sul server: si salva (valore, istante)
 *    e il valore di adesso si calcola con un tasso per ora. Nessun cron, nessun server che gira.
 *  - il pet non muore e non si ammala: al massimo ha fame, vi aspetta, ha sonno; dopo 3 giorni senza cure dorme.
 *  - cresce coi GIORNI di cura (almeno uno ha fatto qualcosa), con un bonus se lo fate entrambi lo stesso giorno.
 */

export type PetKind = "touch" | "feed" | "cuddle" | "play" | "sleep";
export const PET_KINDS: readonly PetKind[] = ["touch", "feed", "cuddle", "play", "sleep"];
export type FoodId = "mora" | "lampone" | "mirtillo" | "pesca";
export const FOOD_IDS: readonly FoodId[] = ["mora", "lampone", "mirtillo", "pesca"];
export type PetStage = "egg" | "seed" | "sprout" | "berry" | "big";
export const PET_STAGES: readonly PetStage[] = ["egg", "seed", "sprout", "berry", "big"];
export type PetMood = "egg" | "asleep" | "away" | "love" | "happy" | "calm" | "hungry" | "waiting" | "sleepy";
export type NeedId = "food" | "love" | "energy";
export const NEED_IDS: readonly NeedId[] = ["food", "love", "energy"];

export const NEED_MAX = 1000;
const HOUR = 3_600_000;
/** Unità perse ogni ora (su 1000): pancia vuota in ~22 h, coccole in ~33 h, energia in ~50 h. */
export const DECAY_PER_HOUR: Record<NeedId, number> = { food: 45, love: 30, energy: 20 };
export const START_NEED = 800;
/** Sotto questa soglia un bisogno "si fa sentire" (faccia di fame, attesa, sonno). */
export const LOW_NEED = 350;
/** Media da cui il pet è proprio contento. */
export const HAPPY_AVG = 650;
/** Senza nessuna cura per tanto tempo torna a dormire (mai triste). */
export const AWAY_AFTER_MS = 72 * HOUR;
/** Quanto dura la nanna dopo "Nanna". */
export const SLEEP_MS = 90 * 60_000;
/** Schiusa: entrambi toccano l'uovo almeno una volta, oppure una persona sola arriva a tanti tocchi. */
export const HATCH_SOLO_TOUCHES = 40;
export const MAX_TOUCH_BATCH = 10;
export const NAME_MAX = 16;
/** Pausa minima fra due azioni uguali della stessa persona (ms). */
export const COOLDOWN_MS: Record<PetKind, number> = {
  touch: 0,
  feed: 45_000,
  cuddle: 20_000,
  play: 30_000,
  sleep: 120_000,
};
/** Punti di crescita (giorni di cura + giorni in cui avete curato in due) per entrare in ogni stadio. */
export const STAGE_AT: Record<PetStage, number> = { egg: -1, seed: 0, sprout: 4, berry: 12, big: 30 };

export type PetState = {
  /** Sale a ogni cambiamento sul server: il più alto vince. */
  rev: number;
  hatchedAt: number | null;
  hatchedBy: string | null;
  touchesA: number;
  touchesB: number;
  name: string | null;
  nameAt: number;
  /** Valori dei bisogni all'istante `at` (poi decadono). */
  food: number;
  love: number;
  energy: number;
  at: number;
  sleepUntil: number;
  /** Ultima cura vera (non i tocchi all'uovo). */
  lastAt: number;
  careDays: number;
  bothDays: number;
  /** Ultimo giorno di cura (AAAA-MM-GG) e chi ha curato in quel giorno. */
  day: string | null;
  dayA: boolean;
  dayB: boolean;
  lastBy: string | null;
  lastKind: PetKind | "hatch" | "name" | null;
  lastItem: FoodId | null;
  /** Chiave di idempotenza dell'ultima azione (serve a non contarla due volte fra coda ed evento). */
  lastKey: string | null;
};

export const emptyPet = (): PetState => ({
  rev: 0,
  hatchedAt: null,
  hatchedBy: null,
  touchesA: 0,
  touchesB: 0,
  name: null,
  nameAt: 0,
  food: START_NEED,
  love: START_NEED,
  energy: START_NEED,
  at: 0,
  sleepUntil: 0,
  lastAt: 0,
  careDays: 0,
  bothDays: 0,
  day: null,
  dayA: false,
  dayB: false,
  lastBy: null,
  lastKind: null,
  lastItem: null,
  lastKey: null,
});

export type PetAction = {
  kind: PetKind;
  item?: FoodId | null;
  /** Solo per "touch": quanti tocchi in questo invio (1-10). */
  amount?: number;
  role: "a" | "b";
  userId: string;
  at: number;
  /** Giorno locale di chi agisce, AAAA-MM-GG. */
  day: string;
  key?: string | null;
};

export type PetOutcome = "applied" | "ignored" | "not_hatched" | "bad_action";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Valore di un bisogno dopo `dt` ms: scende di `rate` unità l'ora (parte intera), mai sotto 0. */
export function decay(v: number, rate: number, dt: number): number {
  return clamp(v - Math.floor((rate * Math.max(dt, 0)) / HOUR), 0, NEED_MAX);
}

export type Needs = Record<NeedId, number>;

/** I tre bisogni all'istante `now`. */
export function needsAt(p: PetState, now: number): Needs {
  const dt = now - p.at;
  return {
    food: decay(p.food, DECAY_PER_HOUR.food, dt),
    love: decay(p.love, DECAY_PER_HOUR.love, dt),
    energy: decay(p.energy, DECAY_PER_HOUR.energy, dt),
  };
}

export const petPoints = (p: Pick<PetState, "careDays" | "bothDays">) => p.careDays + p.bothDays;

export function stageOf(p: Pick<PetState, "hatchedAt" | "careDays" | "bothDays">): PetStage {
  if (p.hatchedAt === null) return "egg";
  const pts = petPoints(p);
  if (pts >= STAGE_AT.big) return "big";
  if (pts >= STAGE_AT.berry) return "berry";
  if (pts >= STAGE_AT.sprout) return "sprout";
  return "seed";
}

/** Quanto manca allo stadio dopo (null = già al massimo o ancora uovo). */
export function stageProgress(p: PetState): { points: number; from: number; to: number } | null {
  const st = stageOf(p);
  if (st === "egg" || st === "big") return null;
  const next = PET_STAGES[PET_STAGES.indexOf(st) + 1];
  return { points: petPoints(p), from: STAGE_AT[st], to: STAGE_AT[next] };
}

/** Avete curato entrambi nel giorno `localDay`? */
export const bothCaredToday = (p: PetState, localDay: string) =>
  p.day === localDay && p.dayA && p.dayB;

/** Il bisogno più basso (a parità: pancia, poi coccole, poi energia). */
export function lowestNeed(n: Needs): NeedId {
  let best: NeedId = "food";
  for (const id of NEED_IDS) if (n[id] < n[best]) best = id;
  return best;
}

/** La faccia del pet adesso. Priorità: uovo, nanna, "dorme da tanto", bisogno basso, amore, contento, tranquillo. */
export function petMood(p: PetState, now: number, localDay: string): PetMood {
  if (p.hatchedAt === null) return "egg";
  if (now < p.sleepUntil) return "asleep";
  if (now - p.lastAt > AWAY_AFTER_MS) return "away";
  const n = needsAt(p, now);
  const low = lowestNeed(n);
  if (n[low] < LOW_NEED) return low === "food" ? "hungry" : low === "love" ? "waiting" : "sleepy";
  if (bothCaredToday(p, localDay)) return "love";
  return (n.food + n.love + n.energy) / 3 >= HAPPY_AVG ? "happy" : "calm";
}

/** Millisecondi da aspettare prima di poter ripetere `kind` (0 = subito). */
export function cooldownLeft(kind: PetKind, lastAt: number | null | undefined, now: number): number {
  if (!lastAt) return 0;
  return Math.max(0, COOLDOWN_MS[kind] - (now - lastAt));
}

export const cleanPetName = (s: string) => s.trim().slice(0, NAME_MAX);

/** Effetto di ogni cibo: [pancia, coccole, energia]. */
export const FOOD_EFFECT: Record<FoodId, [number, number, number]> = {
  mora: [300, 0, 0],
  lampone: [250, 50, 0],
  mirtillo: [200, 0, 100],
  pesca: [400, 0, 0],
};

function registerDay(p: PetState, role: "a" | "b", day: string): PetState {
  if (p.day === null || day > p.day)
    return { ...p, careDays: p.careDays + 1, day, dayA: role === "a", dayB: role === "b" };
  if (day !== p.day) return p; // un'azione in coda di un giorno già passato non conta due volte
  if (role === "a" && !p.dayA) return { ...p, dayA: true, bothDays: p.bothDays + (p.dayB ? 1 : 0) };
  if (role === "b" && !p.dayB) return { ...p, dayB: true, bothDays: p.bothDays + (p.dayA ? 1 : 0) };
  return p;
}

/**
 * Applica un'azione. Stessa logica del SQL `_pet_step`. Il tempo dello stato non torna mai indietro
 * (`t = max(at azione, at stato)`): un'azione vecchia arrivata tardi dalla coda conta "adesso".
 */
export function applyAction(p: PetState, a: PetAction): { pet: PetState; outcome: PetOutcome } {
  const t = Math.max(a.at, p.at);
  if (!PET_KINDS.includes(a.kind)) return { pet: p, outcome: "bad_action" };
  if (a.kind === "touch") {
    if (p.hatchedAt !== null) return { pet: p, outcome: "ignored" };
    const n = clamp(Math.trunc(a.amount ?? 1), 1, MAX_TOUCH_BATCH);
    let q: PetState = {
      ...p,
      rev: p.rev + 1,
      touchesA: p.touchesA + (a.role === "a" ? n : 0),
      touchesB: p.touchesB + (a.role === "b" ? n : 0),
      lastKey: a.key ?? null,
    };
    if ((q.touchesA >= 1 && q.touchesB >= 1) || q.touchesA + q.touchesB >= HATCH_SOLO_TOUCHES) {
      q = {
        ...q,
        hatchedAt: t,
        hatchedBy: a.userId,
        food: START_NEED,
        love: START_NEED,
        energy: START_NEED,
        at: t,
        sleepUntil: 0,
        lastAt: t,
        lastBy: a.userId,
        lastKind: "hatch",
        lastItem: null,
        lastKey: a.key ?? null,
      };
      q = registerDay(q, a.role, a.day);
    }
    return { pet: q, outcome: "applied" };
  }
  if (p.hatchedAt === null) return { pet: p, outcome: "not_hatched" };
  if (a.kind === "feed" && !(a.item && FOOD_IDS.includes(a.item))) return { pet: p, outcome: "bad_action" };

  const n = needsAt(p, t);
  let { food, love, energy } = n;
  let sleepUntil = 0;
  if (a.kind === "feed") {
    const [f, l, e] = FOOD_EFFECT[a.item as FoodId];
    food += f;
    love += l;
    energy += e;
  } else if (a.kind === "cuddle") love += 250;
  else if (a.kind === "play") {
    love += 150;
    energy -= 100;
  } else {
    energy += 500;
    sleepUntil = t + SLEEP_MS;
  }
  let q: PetState = {
    ...p,
    rev: p.rev + 1,
    food: clamp(food, 0, NEED_MAX),
    love: clamp(love, 0, NEED_MAX),
    energy: clamp(energy, 0, NEED_MAX),
    at: t,
    sleepUntil,
    lastAt: t,
    lastBy: a.userId,
    lastKind: a.kind,
    lastItem: a.kind === "feed" ? (a.item as FoodId) : null,
    lastKey: a.key ?? null,
  };
  q = registerDay(q, a.role, a.day);
  return { pet: q, outcome: "applied" };
}

/** Cambio nome: vince l'ultima modifica (last-write-wins). Solo a pet schiuso. */
export function applyName(
  p: PetState,
  name: string,
  at: number,
  key?: string | null,
  by?: string | null,
): PetState {
  const nm = cleanPetName(name);
  if (!nm || p.hatchedAt === null) return p;
  if (p.name !== null && at < p.nameAt) return p;
  return {
    ...p,
    name: nm,
    nameAt: at,
    rev: p.rev + 1,
    lastBy: by ?? p.lastBy,
    lastKind: "name",
    lastItem: null,
    lastKey: key ?? null,
  };
}
