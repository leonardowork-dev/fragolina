import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AWAY_AFTER_MS,
  COOLDOWN_MS,
  DECAY_PER_HOUR,
  FOOD_IDS,
  HATCH_SOLO_TOUCHES,
  LOW_NEED,
  type PetAction,
  type PetState,
  SLEEP_MS,
  applyAction,
  applyName,
  bothCaredToday,
  cooldownLeft,
  decay,
  emptyPet,
  needsAt,
  petMood,
  petPoints,
  stageOf,
  stageProgress,
} from "@/lib/pet/rules";

const H = 3_600_000;
const T0 = Date.UTC(2026, 10, 13, 10, 0, 0);
const act = (over: Partial<PetAction> & Pick<PetAction, "kind">): PetAction => ({
  role: "a",
  userId: "ua",
  at: T0,
  day: "2026-11-13",
  ...over,
});
const apply = (p: PetState, a: PetAction) => applyAction(p, a).pet;
/** Un pet già nato, con i bisogni a `v`, all'istante T0. */
const born = (v = 800): PetState => ({
  ...emptyPet(),
  hatchedAt: T0,
  hatchedBy: "ua",
  food: v,
  love: v,
  energy: v,
  at: T0,
  lastAt: T0,
  careDays: 1,
  day: "2026-11-13",
  dayA: true,
});

describe("pet: bisogni", () => {
  it("scendono col tempo, parte intera, mai sotto 0", () => {
    expect(decay(1000, 45, H)).toBe(955);
    expect(decay(1000, 45, 80_000)).toBe(999); // 45*80000/3.6e6 = 1.0
    expect(decay(1000, 45, 79_999)).toBe(1000);
    expect(decay(100, 45, 100 * H)).toBe(0);
    expect(decay(500, 45, -5 * H)).toBe(500); // il tempo non torna indietro
  });
  it("si calcolano da (valore, istante): niente server che gira", () => {
    const n = needsAt(born(1000), T0 + 10 * H);
    expect(n).toEqual({ food: 550, love: 700, energy: 800 });
  });
  it("tassi: pancia vuota in ~22 h, coccole in ~33 h, energia in ~50 h", () => {
    expect(1000 / DECAY_PER_HOUR.food).toBeCloseTo(22.2, 1);
    expect(1000 / DECAY_PER_HOUR.love).toBeCloseTo(33.3, 1);
    expect(1000 / DECAY_PER_HOUR.energy).toBe(50);
  });
});

describe("pet: uovo e schiusa", () => {
  it("un tocco solo non basta", () => {
    const r = applyAction(emptyPet(), act({ kind: "touch" }));
    expect(r.outcome).toBe("applied");
    expect(r.pet.hatchedAt).toBeNull();
    expect(r.pet.touchesA).toBe(1);
  });
  it("si schiude quando hanno toccato entrambi, e chi lo fa nascere è `hatchedBy`", () => {
    let p = apply(emptyPet(), act({ kind: "touch" }));
    p = apply(p, act({ kind: "touch", role: "b", userId: "ub", at: T0 + 1000 }));
    expect(p.hatchedAt).toBe(T0 + 1000);
    expect(p.hatchedBy).toBe("ub");
    expect([p.food, p.love, p.energy]).toEqual([800, 800, 800]);
    expect(p.careDays).toBe(1);
    expect(stageOf(p)).toBe("seed");
  });
  it("una persona sola può schiuderlo con tanti tocchi", () => {
    let p = emptyPet();
    for (let i = 0; i < 4; i++) p = apply(p, act({ kind: "touch", amount: 10, at: T0 + i }));
    expect(p.hatchedAt).toBe(T0 + 3);
    expect(p.touchesA).toBe(HATCH_SOLO_TOUCHES);
  });
  it("tocchi a lotti: 1-10, il resto si taglia", () => {
    expect(apply(emptyPet(), act({ kind: "touch", amount: 99 })).touchesA).toBe(10);
    expect(apply(emptyPet(), act({ kind: "touch", amount: 0 })).touchesA).toBe(1);
  });
  it("dopo la schiusa i tocchi sono ignorati; le cure prima della schiusa sono rifiutate", () => {
    expect(applyAction(born(), act({ kind: "touch" })).outcome).toBe("ignored");
    expect(applyAction(emptyPet(), act({ kind: "feed", item: "mora" })).outcome).toBe("not_hatched");
  });
});

describe("pet: azioni", () => {
  it("ogni cibo ha il suo effetto", () => {
    const f = (item: (typeof FOOD_IDS)[number]) =>
      apply(born(500), act({ kind: "feed", item }));
    expect(f("mora")).toMatchObject({ food: 800, love: 500, energy: 500 });
    expect(f("lampone")).toMatchObject({ food: 750, love: 550 });
    expect(f("mirtillo")).toMatchObject({ food: 700, energy: 600 });
    expect(f("pesca").food).toBe(900);
  });
  it("i valori restano fra 0 e 1000", () => {
    expect(apply(born(900), act({ kind: "feed", item: "pesca" })).food).toBe(1000);
    expect(apply(born(50), act({ kind: "play" })).energy).toBe(0);
  });
  it("cibo mancante o sconosciuto = azione non valida", () => {
    expect(applyAction(born(), act({ kind: "feed" })).outcome).toBe("bad_action");
    expect(applyAction(born(), act({ kind: "feed", item: "pizza" as any })).outcome).toBe("bad_action");
  });
  it("coccola +250 amore; gioca +150 amore e -100 energia", () => {
    expect(apply(born(500), act({ kind: "cuddle" })).love).toBe(750);
    const p = apply(born(500), act({ kind: "play" }));
    expect([p.love, p.energy]).toEqual([650, 400]);
  });
  it("nanna: +500 energia e dorme 90 minuti; un'altra cura sveglia", () => {
    const p = apply(born(300), act({ kind: "sleep", at: T0 + H }));
    expect(p.sleepUntil).toBe(T0 + H + SLEEP_MS);
    expect(petMood(p, T0 + H + 60_000, "2026-11-13")).toBe("asleep");
    const w = apply(p, act({ kind: "cuddle", at: T0 + H + 1000 }));
    expect(w.sleepUntil).toBe(0);
  });
  it("applica il decadimento PRIMA di sommare", () => {
    // dopo 10 h la pancia è 800-450=350; +300 = 650
    const p = apply(born(800), act({ kind: "feed", item: "mora", at: T0 + 10 * H }));
    expect(p.food).toBe(650);
    expect(p.at).toBe(T0 + 10 * H);
  });
  it("il tempo dello stato non torna indietro: un'azione vecchia conta 'adesso'", () => {
    const p = apply(born(), act({ kind: "cuddle", at: T0 - 5 * H }));
    expect(p.at).toBe(T0);
    expect(p.lastAt).toBe(T0);
  });
  it("registra chi ha fatto cosa (per il registro e il toast)", () => {
    const p = apply(born(), act({ kind: "feed", item: "mora", userId: "ub", role: "b", key: "k1" }));
    expect(p).toMatchObject({ lastBy: "ub", lastKind: "feed", lastItem: "mora", lastKey: "k1" });
  });
  it("pause per persona e azione", () => {
    expect(cooldownLeft("feed", T0, T0 + 10_000)).toBe(COOLDOWN_MS.feed - 10_000);
    expect(cooldownLeft("feed", T0, T0 + COOLDOWN_MS.feed)).toBe(0);
    expect(cooldownLeft("feed", undefined, T0)).toBe(0);
    expect(cooldownLeft("touch", T0, T0)).toBe(0);
  });
});

describe("pet: crescita", () => {
  it("conta i giorni di cura, non il tempo che passa", () => {
    let p = born();
    p = apply(p, act({ kind: "cuddle", at: T0 + 100 })); // stesso giorno: niente
    expect(p.careDays).toBe(1);
    p = apply(p, act({ kind: "cuddle", at: T0 + 24 * H, day: "2026-11-14" }));
    expect(p.careDays).toBe(2);
    expect(petPoints(p)).toBe(2);
  });
  it("bonus quando lo curate in due lo stesso giorno (una volta sola al giorno)", () => {
    let p = born();
    p = apply(p, act({ kind: "cuddle", role: "b", userId: "ub", at: T0 + 10 }));
    expect(p.bothDays).toBe(1);
    expect(bothCaredToday(p, "2026-11-13")).toBe(true);
    p = apply(p, act({ kind: "cuddle", role: "b", userId: "ub", at: T0 + 20 }));
    p = apply(p, act({ kind: "cuddle", role: "a", at: T0 + 30 }));
    expect(p.bothDays).toBe(1);
  });
  it("un'azione in coda di un giorno passato non conta due volte", () => {
    let p = born();
    p = apply(p, act({ kind: "cuddle", at: T0 + 24 * H, day: "2026-11-14" }));
    p = apply(p, act({ kind: "cuddle", role: "b", userId: "ub", at: T0 + 25 * H, day: "2026-11-13" }));
    expect(p.careDays).toBe(2);
    expect(p.bothDays).toBe(0);
  });
  it("stadi: seme, germoglio, fragolina, fragolona", () => {
    const at = (c: number, b = 0) => stageOf({ hatchedAt: 1, careDays: c, bothDays: b });
    expect(stageOf({ hatchedAt: null, careDays: 99, bothDays: 99 })).toBe("egg");
    expect([at(0), at(3), at(4), at(11), at(12), at(29), at(30)]).toEqual([
      "seed", "seed", "sprout", "sprout", "berry", "berry", "big",
    ]);
    expect(at(2, 2)).toBe("sprout"); // bonus
  });
  it("avanzamento verso lo stadio dopo", () => {
    expect(stageProgress({ ...born(), careDays: 6 })).toEqual({ points: 6, from: 4, to: 12 });
    expect(stageProgress({ ...born(), careDays: 40 })).toBeNull();
    expect(stageProgress(emptyPet())).toBeNull();
  });
});

describe("pet: umore (la faccia)", () => {
  const day = "2026-11-13";
  it("uovo", () => expect(petMood(emptyPet(), T0, day)).toBe("egg"));
  it("contento, tranquillo", () => {
    expect(petMood(born(800), T0, day)).toBe("happy");
    expect(petMood(born(500), T0, day)).toBe("calm");
  });
  it("un bisogno basso si fa sentire; a parità vince la pancia", () => {
    expect(petMood({ ...born(800), food: 300 }, T0, day)).toBe("hungry");
    expect(petMood({ ...born(800), love: 300 }, T0, day)).toBe("waiting");
    expect(petMood({ ...born(800), energy: 300 }, T0, day)).toBe("sleepy");
    expect(petMood({ ...born(300) }, T0, day)).toBe("hungry");
    expect(petMood({ ...born(800), food: LOW_NEED }, T0, day)).not.toBe("hungry");
  });
  it("col tempo i bisogni scendono e la faccia cambia da sola", () => {
    const p = born(800);
    expect(petMood(p, T0 + 2 * H, day)).toBe("happy");
    expect(petMood(p, T0 + 12 * H, day)).toBe("hungry"); // pancia 800-540=260
  });
  it("'vi vuole bene' quando avete curato in due oggi e nessun bisogno è basso", () => {
    const p = { ...born(800), dayB: true, bothDays: 1 };
    expect(petMood(p, T0, day)).toBe("love");
    expect(petMood(p, T0 + 24 * H, "2026-11-14")).not.toBe("love");
    expect(petMood({ ...p, food: 100 }, T0, day)).toBe("hungry");
  });
  it("dopo 3 giorni senza cure torna a dormire: mai morto, mai malato", () => {
    const p = born(0);
    expect(petMood(p, T0 + AWAY_AFTER_MS, day)).not.toBe("away");
    expect(petMood(p, T0 + AWAY_AFTER_MS + 1, day)).toBe("away");
    expect(petMood(p, T0 + 400 * 24 * H, day)).toBe("away");
  });
  it("tornare a curarlo lo sveglia", () => {
    const p = apply(born(0), act({ kind: "feed", item: "pesca", at: T0 + 10 * 24 * H, day: "2026-11-23" }));
    expect(petMood(p, T0 + 10 * 24 * H + 1000, "2026-11-23")).not.toBe("away");
  });
});

describe("pet: nome", () => {
  it("max 16 caratteri, solo a pet schiuso, last-write-wins", () => {
    expect(applyName(emptyPet(), "Fragi", 5).name).toBeNull();
    let p = applyName(born(), "  Fragolotta Reale Primissima  ", 100);
    expect(p.name).toBe("Fragolotta Reale");
    expect(p.name!.length).toBe(16);
    const before = p.rev;
    p = applyName(p, "Vecchio", 50); // più vecchio: perde
    expect(p.name).toBe("Fragolotta Reale");
    expect(p.rev).toBe(before);
    p = applyName(p, "Bacca", 200);
    expect(p.name).toBe("Bacca");
    expect(applyName(p, "   ", 300).name).toBe("Bacca");
  });
});

/** Fixture condivisa con SQL (scripts/sql-check.mjs) e Swift (tests/swiftParity.test.ts). */
describe("pet: sequenza di riferimento (parità TS ↔ SQL ↔ Swift)", () => {
  const file = path.resolve(__dirname, "fixtures/pet-sequence.json");
  type Step = { action: PetAction; outcome: string; after: PetState };
  function build() {
    let seed = 20261113;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const steps: Step[] = [];
    let p = emptyPet();
    let t = T0;
    const users = { a: "11111111-1111-1111-1111-111111111111", b: "22222222-2222-2222-2222-222222222222" };
    const push = (a: PetAction) => {
      const r = applyAction(p, a);
      steps.push({ action: a, outcome: r.outcome, after: r.pet });
      p = r.pet;
    };
    const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    // prefisso scritto a mano: uovo, schiusa, cure
    push({ kind: "touch", amount: 3, role: "a", userId: users.a, at: t, day: dayOf(t), key: "k-0000001" });
    push({ kind: "feed", item: "mora", role: "a", userId: users.a, at: t + 1, day: dayOf(t), key: "k-0000002" }); // non_hatched
    push({ kind: "touch", amount: 1, role: "b", userId: users.b, at: t + 5000, day: dayOf(t), key: "k-0000003" }); // schiusa
    push({ kind: "touch", amount: 1, role: "b", userId: users.b, at: t + 6000, day: dayOf(t), key: "k-0000004" }); // ignorato
    const kinds: PetAction["kind"][] = ["feed", "feed", "cuddle", "play", "sleep", "touch"];
    for (let i = 0; i < 300; i++) {
      const roll = rnd();
      // salti: pochi minuti, ore, giorni, ogni tanto un'azione "vecchia" (in coda offline) o un salto di settimane
      t += roll < 0.5 ? Math.floor(rnd() * 600_000) : roll < 0.85 ? Math.floor(rnd() * 14 * H) : roll < 0.97 ? Math.floor(rnd() * 5 * 24 * H) : Math.floor(rnd() * 30 * 24 * H);
      const at = rnd() < 0.08 ? t - Math.floor(rnd() * 3 * H) : t;
      const role = rnd() < 0.5 ? "a" : "b";
      const kind = kinds[Math.floor(rnd() * kinds.length)]!;
      push({
        kind,
        item: kind === "feed" ? FOOD_IDS[Math.floor(rnd() * 4)] : null,
        amount: kind === "touch" ? 1 + Math.floor(rnd() * 12) : 1,
        role,
        userId: users[role],
        at,
        day: dayOf(rnd() < 0.05 ? t - 24 * H : t),
        key: `k-${String(i + 10).padStart(7, "0")}`,
      });
    }
    return { initial: emptyPet(), steps };
  }
  it("la sequenza salvata è quella che le regole producono oggi", () => {
    const now = build();
    if (process.env.UPDATE_PET_FIXTURE === "1") fs.writeFileSync(file, JSON.stringify(now, null, 1) + "\n");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(saved).toEqual(JSON.parse(JSON.stringify(now)));
  });
  it("copre tutti gli esiti, gli stadi e le facce principali", () => {
    const { steps } = build();
    const outs = new Set(steps.map((s) => s.outcome));
    expect(outs.has("applied") && outs.has("ignored") && outs.has("not_hatched")).toBe(true);
    const kinds = new Set(steps.filter((s) => s.outcome === "applied").map((s) => s.action.kind));
    expect(kinds.size).toBe(5);
    const stages = new Set(steps.map((s) => stageOf(s.after)));
    expect(stages.has("seed")).toBe(true);
    expect(steps.some((s) => s.after.bothDays > 0)).toBe(true);
    expect(steps.some((s) => s.after.food === 1000)).toBe(true);
  });
});
