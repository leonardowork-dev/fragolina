import { daysTogether, nextRecurrence, shortDateYmd, untilText } from "@/lib/recurrence";
import { timeAgo } from "@/lib/time";
import type { WidgetSnapshot } from "@/lib/widgetPayload";

/**
 * Replica in TypeScript delle proprietà calcolate di `FragolinaEntry` (targets/widget/Model.swift), SOLO per
 * l'anteprima nel laboratorio. Le parti con una regola vera (giorni, ricorrenza, "X fa") usano le stesse funzioni
 * che la prova Swift confronta con il codice reale (tests/swiftParity.test.ts).
 */
export const HARD_STALE_S = 48 * 3600;
export const SOFT_STALE_S = 3 * 3600;

export type EntryState = "empty" | "unpaired" | "hardStale" | "ok";

export function ageShort(sec: number): string {
  const a = Math.max(0, sec);
  if (a < 90) return "adesso";
  if (a < 3600) return `${Math.floor(a / 60)} min`;
  if (a < 86400) return `${Math.floor(a / 3600)} h`;
  return `${Math.floor(a / 86400)} g`;
}

export class PreviewEntry {
  constructor(
    readonly snap: WidgetSnapshot | null,
    readonly nowMs: number,
    readonly todayIso: string,
  ) {}
  get age(): number | null {
    return this.snap && this.snap.updatedAt > 0 ? Math.max(0, (this.nowMs - this.snap.updatedAt) / 1000) : null;
  }
  get isSoftStale() {
    return (this.age ?? 0) > SOFT_STALE_S && !this.isHardStale;
  }
  get isHardStale() {
    return (this.age ?? 0) > HARD_STALE_S;
  }
  get state(): EntryState {
    if (!this.snap) return "empty";
    if (!this.snap.paired) return "unpaired";
    if (this.isHardStale) return "hardStale";
    return "ok";
  }
  get daysValue() {
    return daysTogether(this.snap?.startDate, this.todayIso);
  }
  get daysText() {
    return this.daysValue === null ? "–" : String(this.daysValue);
  }
  get recurrence() {
    return nextRecurrence(this.snap?.startDate, this.todayIso);
  }
  get partner() {
    return this.snap?.partnerName || "Lei";
  }
  get me() {
    return this.snap?.myName || "Tu";
  }
  get moodId() {
    return this.snap?.moodId ?? null;
  }
  get moodLabel() {
    return this.snap?.moodLabel ?? "";
  }
  get myMoodId() {
    return this.snap?.myMoodId ?? null;
  }
  get myMoodLabel() {
    return this.snap?.myMoodLabel ?? "";
  }
  get thoughts() {
    return this.snap?.thinkingToday ?? 0;
  }
  get received() {
    return this.snap?.pingsReceived ?? 0;
  }
  get updatedText() {
    return "aggiornato " + timeAgo(this.nowMs - (this.age ?? 0) * 1000, this.nowMs);
  }
  get ageShort() {
    return ageShort(this.age ?? 0);
  }
  since(ms: number | null | undefined): string | null {
    if (!ms) return null;
    const s = Math.max(0, (this.nowMs - ms) / 1000);
    return s < 90 ? "adesso" : "da " + ageShort(s);
  }
  get moodSince() {
    return this.since(this.snap?.moodAt);
  }
  get myMoodSince() {
    return this.since(this.snap?.myMoodAt);
  }
  get lastPingText(): string | null {
    return this.snap?.lastPingAt ? "l'ultimo " + timeAgo(this.snap.lastPingAt, this.nowMs) : null;
  }
  get isParty() {
    return (this.recurrence?.daysUntil ?? 1) === 0;
  }
  get nextLine(): string | null {
    const r = this.recurrence;
    if (!r) return null;
    const s = `${untilText(r.daysUntil)}: ${r.label}`;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  get daysCaption() {
    return this.daysValue === 1 ? "giorno insieme" : "giorni insieme";
  }
  get partnerShort() {
    if (this.partner.length <= 14) return this.partner;
    return this.partner.split(/[ -]/)[0] ?? this.partner;
  }
  get meShort() {
    const first = this.me.split(/[ -]/)[0] ?? this.me;
    return first.length > 12 ? "Tu" : first;
  }
  get lockDaysWith(): string {
    const d = this.daysValue;
    if (d === null) return "Da quando?";
    return d === 1 ? `1 giorno con ${this.partnerShort}` : `${d} giorni con ${this.partnerShort}`;
  }
  shortDate(iso: string) {
    return shortDateYmd(iso);
  }
}
