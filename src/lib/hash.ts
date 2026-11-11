/** Hash deterministico di una stringa (FNV-1a, 32 bit). Serve per inclinazioni e fisica stabili. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Numero pseudo-casuale deterministico in [0,1) da un seme intero (mulberry32). */
export function seeded(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclinazione stabile (gradi) per un id: sempre tra -max e +max, mai casuale a ogni render. */
export function tiltFor(id: string, max = 2): number {
  const r = seeded(hashString(id));
  return Math.round((r * 2 - 1) * max * 10) / 10;
}
