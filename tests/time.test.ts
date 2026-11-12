import { afterAll, describe, expect, it } from "vitest";

import { daysBetweenIso, daysSince, localDayKey, localDayStartMs, timeAgo } from "@/lib/time";

const realTZ = process.env.TZ;
afterAll(() => {
  if (realTZ === undefined) delete process.env.TZ;
  else process.env.TZ = realTZ;
});
const at = (tz: string, y: number, m: number, d: number, h = 12, min = 0) => {
  process.env.TZ = tz;
  return new Date(y, m - 1, d, h, min);
};

describe("giorni insieme (Europe/Rome)", () => {
  it("ora legale che finisce (26/10/2025, giorno di 25 ore)", () => {
    expect(daysSince("2025-10-25", at("Europe/Rome", 2025, 10, 27, 0, 30))).toBe(2);
    expect(daysSince("2025-10-26", at("Europe/Rome", 2025, 10, 27, 0, 0))).toBe(1);
    expect(daysSince("2025-10-26", at("Europe/Rome", 2025, 10, 26, 23, 59))).toBe(0);
  });
  it("ora legale che inizia (29/03/2026, giorno di 23 ore)", () => {
    expect(daysSince("2026-03-28", at("Europe/Rome", 2026, 3, 30, 0, 30))).toBe(2);
    expect(daysSince("2026-03-29", at("Europe/Rome", 2026, 3, 30, 0, 0))).toBe(1);
    expect(daysSince("2026-03-28", at("Europe/Rome", 2026, 3, 29, 3, 30))).toBe(1);
  });
  it("lo stesso risultato intorno a mezzanotte, prima e dopo", () => {
    expect(daysSince("2025-02-14", at("Europe/Rome", 2026, 2, 14, 23, 59))).toBe(365);
    expect(daysSince("2025-02-14", at("Europe/Rome", 2026, 2, 15, 0, 0))).toBe(366);
  });
  it("anno bisestile", () => {
    expect(daysBetweenIso("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetweenIso("2025-02-28", "2025-03-01")).toBe(1);
  });
  it("data nel futuro, mancante o malformata = 0", () => {
    expect(daysSince("2030-01-01", at("Europe/Rome", 2026, 1, 1))).toBe(0);
    expect(daysSince(null)).toBe(0);
    expect(daysSince("")).toBe(0);
    expect(daysSince("boh")).toBe(0);
  });
});

describe("confini di fuso orario", () => {
  const instant = Date.UTC(2026, 0, 1, 23, 30); // 23:30 UTC
  it("lo stesso istante cade in giorni diversi nei vari fusi", () => {
    process.env.TZ = "Europe/Rome";
    expect(localDayKey(new Date(instant))).toBe("2026-01-02"); // 00:30
    process.env.TZ = "America/Los_Angeles";
    expect(localDayKey(new Date(instant))).toBe("2026-01-01"); // 15:30
    process.env.TZ = "Pacific/Auckland";
    expect(localDayKey(new Date(instant))).toBe("2026-01-02"); // 12:30
  });
  it("giorni insieme usa il calendario del telefono, non UTC", () => {
    process.env.TZ = "Europe/Rome";
    expect(daysSince("2026-01-01", new Date(instant))).toBe(1);
    process.env.TZ = "America/Los_Angeles";
    expect(daysSince("2026-01-01", new Date(instant))).toBe(0);
  });
  it("mezzanotte locale e DST: localDayStartMs è sempre l'inizio del giorno", () => {
    process.env.TZ = "Europe/Rome";
    const d = new Date(2026, 2, 29, 15, 0); // giorno di 23 ore
    const start = localDayStartMs(d);
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(start).getDate()).toBe(29);
    expect((d.getTime() - start) / 3_600_000).toBeCloseTo(14, 5); // 15:00 locali = 14 ore dopo (una persa)
  });
});

describe("timeAgo", () => {
  const now = 1_000_000_000_000;
  it("formati", () => {
    expect(timeAgo(now - 10_000, now)).toBe("adesso");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min fa");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("3 h fa");
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe("ieri");
    expect(timeAgo(now - 5 * 86_400_000, now)).toBe("5 giorni fa");
    expect(timeAgo(now + 5000, now)).toBe("adesso");
  });
});
