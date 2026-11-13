import { type Needs, type PetMood, type PetState, LOW_NEED, emptyPet, needsAt, petMood } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";
import { timeAgo } from "@/lib/time";
import type { WidgetSnapshot } from "@/lib/widgetPayload";

/**
 * Cosa mostra il widget del pet, calcolato SOLO dai campi dello snapshot e dall'orario della voce della timeline
 * (il widget non ha store né server). Specchio di `FragolinaEntry.pet*` in targets/widget/Model.swift: la prova
 * tests/swiftParity.test.ts confronta le due versioni su migliaia di casi (facce, bisogni, testi, date).
 * Usato anche dall'anteprima web (/widget-preview).
 */
export type PetWidgetModel = {
  hatched: boolean;
  stage: string;
  name: string;
  mood: PetMood;
  needs: Needs;
  /** Pallini pieni (1-3) per ogni bisogno. */
  dots: { food: number; love: number; energy: number };
  say: string;
  lastLine: string | null;
};

export function petFromSnapshot(s: WidgetSnapshot): PetState {
  return {
    ...emptyPet(),
    hatchedAt: s.petHatched ? (s.petAt ?? 1) : null,
    food: s.petFood,
    love: s.petLove,
    energy: s.petEnergy,
    at: s.petAt ?? 0,
    sleepUntil: s.petSleepUntil,
    lastAt: s.petLastAt ?? 0,
    day: s.petDay || null,
    dayA: s.petBoth,
    dayB: s.petBoth,
  };
}

export const dotsFor = (v: number) => (v < LOW_NEED ? 1 : v < 650 ? 2 : 3);

export const EGG_LINE = "Toccatelo in due.";

export function petWidgetModel(s: WidgetSnapshot, nowMs: number, todayIso: string): PetWidgetModel {
  const p = petFromSnapshot(s);
  const hatched = p.hatchedAt !== null;
  const mood = petMood(p, nowMs, todayIso);
  const needs = needsAt(p, nowMs);
  const partner = s.partnerName || "Lei";
  const food = s.petLastItem as keyof typeof S.pet.foodGiven;
  let lastLine: string | null = null;
  if (hatched && s.petLastAt && s.petLastBy) {
    const who = s.petLastBy === "me" ? null : partner;
    const L = S.pet.logLine;
    const text =
      s.petLastKind === "feed"
        ? L.feed(who, S.pet.foodGiven[food] ?? "un frutto")
        : s.petLastKind === "cuddle"
          ? L.cuddle(who)
          : s.petLastKind === "play"
            ? L.play(who)
            : s.petLastKind === "sleep"
              ? L.sleep(who)
              : s.petLastKind === "hatch"
                ? L.hatch(who)
                : null;
    if (text) lastLine = `${text} · ${timeAgo(s.petLastAt, nowMs)}`;
  }
  return {
    hatched,
    stage: s.petStage || "egg",
    name: s.petName || S.pet.defaultName,
    mood,
    needs,
    dots: { food: dotsFor(needs.food), love: dotsFor(needs.love), energy: dotsFor(needs.energy) },
    say: hatched ? S.pet.say[mood] : EGG_LINE,
    lastLine,
  };
}

/**
 * Voci della timeline del widget pet: ogni ora per 24 h (la faccia cambia anche con l'app chiusa), più gli istanti
 * esatti in cui cambia qualcosa di netto (fine nanna, "torna a dormire") e un attimo dopo ogni mezzanotte (la festa
 * "vi vuole bene" vale per il giorno). Millisecondi, ordinati, senza doppioni a meno di 1 s.
 */
export function petTimelineMs(nowMs: number, s: WidgetSnapshot, midnights: number[]): number[] {
  const H = 3_600_000;
  const out: number[] = [nowMs];
  for (let i = 1; i <= 24; i++) out.push(nowMs + i * H);
  const add = (t: number) => {
    if (t > nowMs && t <= nowMs + 24 * H + 1000) out.push(t);
  };
  if (s.petHatched) {
    if (s.petSleepUntil > 0) add(s.petSleepUntil + 1000);
    if (s.petLastAt) add(s.petLastAt + 72 * H + 1000);
  }
  for (const m of midnights) add(m);
  const sorted = out.sort((a, b) => a - b);
  const uniq: number[] = [];
  for (const t of sorted) if (uniq.length === 0 || t - uniq[uniq.length - 1]! >= 1000) uniq.push(t);
  return uniq;
}
