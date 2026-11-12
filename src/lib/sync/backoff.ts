/** Attesa prima del tentativo n (0, 1, 2…): 1 s, 2 s, 4 s… fino a 30 s, con un po' di casualità (jitter). */
export function backoffDelay(attempt: number, rng: () => number = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.6 + rng() * 0.4));
}
