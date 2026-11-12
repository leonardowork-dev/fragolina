import { describe, expect, it } from "vitest";

import { createPushScheduler } from "@/lib/pushScheduler";

/** Orologio finto: i timer scattano quando `tick` supera la loro scadenza. */
function fakeClock() {
  let t = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => t,
    setTimer: (fn: () => void, ms: number) => {
      timers.set(++id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (h: unknown) => void timers.delete(h as number),
    tick(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        t = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      t = end;
    },
  };
}

describe("scheduler delle scritture verso il widget", () => {
  it("una raffica di eventi = una sola scrittura, dopo 1,5 s di quiete", () => {
    const c = fakeClock();
    const calls: boolean[] = [];
    const s = createPushScheduler({ debounceMs: 1500, maxWaitMs: 6000, run: (f) => calls.push(f), ...c });
    for (let i = 0; i < 10; i++) {
      s.notify();
      c.tick(300);
    }
    expect(calls).toEqual([]);
    c.tick(1500);
    expect(calls).toEqual([false]);
  });
  it("se gli eventi non smettono mai, scrive comunque dopo l'attesa massima (6 s)", () => {
    const c = fakeClock();
    const calls: number[] = [];
    const s = createPushScheduler({ debounceMs: 1500, maxWaitMs: 6000, run: () => calls.push(c.now()), ...c });
    for (let i = 0; i < 40; i++) {
      s.notify();
      c.tick(500);
    }
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls[0]).toBeLessThanOrEqual(6000);
    for (let i = 1; i < calls.length; i++) expect(calls[i] - calls[i - 1]).toBeGreaterThanOrEqual(1500);
  });
  it("flushNow scrive subito e cancella l'attesa (secondo piano)", () => {
    const c = fakeClock();
    const calls: boolean[] = [];
    const s = createPushScheduler({ debounceMs: 1500, maxWaitMs: 6000, run: (f) => calls.push(f), ...c });
    s.notify();
    s.flushNow();
    expect(calls).toEqual([true]);
    c.tick(5000);
    expect(calls).toEqual([true]);
    expect(s.pending).toBe(false);
  });
  it("force si ricorda fino alla scrittura (ritorno in primo piano)", () => {
    const c = fakeClock();
    const calls: boolean[] = [];
    const s = createPushScheduler({ debounceMs: 1500, maxWaitMs: 6000, run: (f) => calls.push(f), ...c });
    s.notify(true);
    s.notify();
    c.tick(1500);
    expect(calls).toEqual([true]);
    s.notify();
    c.tick(1500);
    expect(calls).toEqual([true, false]);
  });
  it("dispose annulla", () => {
    const c = fakeClock();
    const calls: boolean[] = [];
    const s = createPushScheduler({ debounceMs: 1500, maxWaitMs: 6000, run: (f) => calls.push(f), ...c });
    s.notify();
    s.dispose();
    c.tick(9000);
    expect(calls).toEqual([]);
  });
});
