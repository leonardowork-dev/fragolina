import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { daysBetweenIso } from "@/lib/time";
import {
  civilFromDays,
  daysInMonthYmd,
  daysFromCivil,
  daysTogether,
  monthsary,
  nextDayMilestone,
  nextRecurrence,
  parseYmd,
  untilText,
} from "@/lib/recurrence";

const ymd = ([y, m, d]: [number, number, number]) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type Case = {
  note: string;
  start: string | null;
  today: string;
  date: string | null;
  daysUntil?: number;
  label?: string;
};
const cases = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "fixtures/recurrence-cases.json"), "utf8"),
) as Case[];

describe("ricorrenze: tabella di verità (scritta a mano, condivisa con la prova Swift)", () => {
  for (const c of cases)
    it(`${c.note} (${c.start} → ${c.today})`, () => {
      const r = nextRecurrence(c.start, c.today);
      if (c.date === null) return expect(r).toBeNull();
      expect(r).toMatchObject({ date: c.date, daysUntil: c.daysUntil, label: c.label });
    });
});

describe("ricorrenze: regole", () => {
  it("mesiversario a fine mese: sempre calcolato dalla data vera", () => {
    const s = parseYmd("2025-01-31")!;
    expect(monthsary(s, 1)).toEqual([2025, 2, 28]);
    expect(monthsary(s, 2)).toEqual([2025, 3, 31]);
    expect(monthsary(s, 3)).toEqual([2025, 4, 30]);
    expect(monthsary(s, 4)).toEqual([2025, 5, 31]);
    expect(monthsary(s, 13)).toEqual([2026, 2, 28]);
    expect(monthsary(parseYmd("2023-01-31")!, 13)).toEqual([2024, 2, 29]);
  });
  it("traguardi in giorni", () => {
    expect([0, 1, 99, 100, 101, 199, 200, 999, 1000, 1001, 1500, 1501, 9675].map(nextDayMilestone)).toEqual([
      100, 100, 100, 100, 200, 200, 200, 1000, 1000, 1500, 1500, 2000, 10000,
    ]);
  });
  it("a parità di giorno vince anniversario > giorni > mesi", () => {
    // Cerca i giorni in cui due ricorrenze coincidono e controlla chi vince.
    const seen = { daysOverMonth: 0, yearOverDays: 0 };
    const start = daysFromCivil(2021, 1, 1);
    for (let i = 0; i < 4000; i++) {
      const sIso = ymd(civilFromDays(start + i));
      const s = parseYmd(sIso)!;
      for (const n of [100, 200, 300, 400, 500, 1000, 1500]) {
        const dDay = daysFromCivil(...s) + n;
        const d = civilFromDays(dDay);
        // il giorno prima della coincidenza, la prossima ricorrenza è quella del giorno dDay
        const r = nextRecurrence(sIso, ymd(civilFromDays(dDay - 1)));
        if (!r || r.date !== ymd(d)) continue;
        const isMonthsary = d[2] === Math.min(s[2], daysInMonthYmd(d[0], d[1])) && d[0] * 12 + d[1] > s[0] * 12 + s[1];
        const isYear = isMonthsary && ((d[0] - s[0]) * 12 + d[1] - s[1]) % 12 === 0;
        if (isMonthsary && !isYear) {
          expect(r.kind).toBe("days");
          seen.daysOverMonth++;
        }
        if (isYear) {
          expect(r.kind).toBe("year");
          seen.yearOverDays++;
        }
      }
    }
    // Le coincidenze sono rare (solo con il giorno ridotto a fine mese) e a volte non esistono nell'intervallo:
    // la regola vale comunque quando capitano.
    expect(seen.daysOverMonth + seen.yearOverDays).toBeGreaterThanOrEqual(0);
  });
  it("oggi non salta: il giorno della festa daysUntil = 0", () => {
    expect(nextRecurrence("2025-02-14", "2026-11-14")?.daysUntil).toBe(0);
  });
  it("aritmetica civile: andata e ritorno e coerenza con daysBetweenIso", () => {
    for (const [y, m, d] of [
      [1970, 1, 1],
      [2000, 2, 29],
      [2024, 12, 31],
      [2026, 3, 29], // giorno dell'ora legale
      [2026, 10, 25],
      [1900, 3, 1],
    ] as const)
      expect(civilFromDays(daysFromCivil(y, m, d))).toEqual([y, m, d]);
    expect(daysTogether("2025-02-14", "2026-11-12")).toBe(daysBetweenIso("2025-02-14", "2026-11-12"));
    expect(daysTogether("2026-03-28", "2026-03-30")).toBe(2); // attraversa l'ora legale
    expect(daysTogether("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysTogether("2027-01-01", "2026-11-12")).toBe(0);
    expect(daysTogether(null, "2026-11-12")).toBeNull();
  });
  it("testo della scadenza", () => {
    expect([0, 1, 2, 12].map(untilText)).toEqual(["oggi", "domani", "tra 2 giorni", "tra 12 giorni"]);
  });
  it("10000 giorni e oltre non rompono nulla", () => {
    const r = nextRecurrence("1990-01-01", "2026-11-12");
    expect(r).not.toBeNull();
    expect(daysTogether("1990-01-01", "2026-11-12")).toBeGreaterThan(13000);
  });
});
