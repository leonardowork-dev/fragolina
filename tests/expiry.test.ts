import { describe, expect, it } from "vitest";

import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { cleanExpiry, effectiveExpiry, expiryView, renewTimelineMs } from "@/lib/expiry";

const NOW = new Date(2026, 10, 25, 10, 0, 0).getTime();
const DAY = 86_400_000;

describe("scadenza dell'app", () => {
  it("ignora date assurde", () => {
    expect(cleanExpiry(1)).toBeNull();
    expect(cleanExpiry(9e15)).toBeNull();
    expect(cleanExpiry("x")).toBeNull();
    expect(cleanExpiry(NOW)).toBe(NOW);
  });
  it("vale la scadenza più lontana (dopo un rinnovo)", () => {
    expect(effectiveExpiry(NOW + DAY, NOW + 7 * DAY)).toBe(NOW + 7 * DAY);
    expect(effectiveExpiry(null, NOW)).toBe(NOW);
    expect(effectiveExpiry(null, null)).toBeNull();
  });
  it("stati: ok, soon, last, expired, none", () => {
    expect(expiryView(NOW + 5 * DAY, NOW).state).toBe("ok");
    expect(expiryView(NOW + 2 * DAY, NOW).state).toBe("soon");
    expect(expiryView(NOW + 3600_000, NOW).state).toBe("last");
    expect(expiryView(NOW - 1, NOW).state).toBe("expired");
    expect(expiryView(null, NOW).state).toBe("none");
  });
  it("giorni di calendario ed etichetta", () => {
    const v = expiryView(new Date(2026, 10, 28, 14, 0, 0).getTime(), NOW);
    expect(v.days).toBe(3);
    expect(v.dayLabel).toBe("sabato 28");
  });
  it("voce di timeline all'inizio dell'ultimo giorno", () => {
    expect(renewTimelineMs(NOW + 5 * 3600_000 + DAY, NOW)).toBe(NOW + 5 * 3600_000);
    expect(renewTimelineMs(NOW + 5 * DAY, NOW)).toBeNull();
  });
});

describe("scadenza sul finto server", () => {
  it("l'altra persona vede la mia scadenza", async () => {
    const t = memoryTransport();
    const mk = (uid: string) => new MockBackend(t, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => NOW });
    const A = mk("ua");
    const B = mk("ub");
    const c = await A.createCouple("Leonardo", null);
    await B.joinCouple(c.code, "Nikole");
    await A.setAppExpiry(NOW + 5 * DAY);
    const p = await B.getPartnerExpiry();
    expect(p?.name).toBe("Leonardo");
    expect(p?.expiresAt).toBe(NOW + 5 * DAY);
    expect((await A.getPartnerExpiry())?.expiresAt).toBeNull();
    await expect(A.setAppExpiry(NOW + 900 * DAY)).rejects.toBeTruthy();
  });
});
