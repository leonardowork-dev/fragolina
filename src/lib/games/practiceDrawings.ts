import type { InkKey, NoteDraw, NoteStroke } from "@/lib/note/rules";

/**
 * Disegni preregistrati della Fragolina per la "Prova da solo": vettori 0-1000 come quelli veri (stessi limiti del
 * biglietto, provati in tests/practice.test.ts). Ogni parola sta anche in WORD_DECK.
 */
const r = (n: number) => Math.round(n);
const ring = (cx: number, cy: number, rad: number, n = 28, rot = 0): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [r(cx + Math.cos(a) * rad), r(cy + Math.sin(a) * rad)] as [number, number];
  });
const line = (...p: [number, number][]) => p;
const st = (c: InkKey, w: 1 | 2, p: [number, number][]): NoteStroke => ({ c, w, p });

const sun: NoteDraw = {
  strokes: [
    st("butter", 2, ring(500, 500, 150)),
    ...Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return st("butter", 2, line([r(500 + Math.cos(a) * 210), r(500 + Math.sin(a) * 210)], [r(500 + Math.cos(a) * 330), r(500 + Math.sin(a) * 330)]));
    }),
    st("ink", 1, line([450, 470], [452, 472])),
    st("ink", 1, line([550, 470], [552, 472])),
    st("ink", 1, [[440, 550], [470, 585], [500, 595], [530, 585], [560, 550]]),
  ],
};
const moon: NoteDraw = {
  strokes: [
    st("ink", 2, [...ring(500, 500, 280, 30, 0.9).slice(0, 19), ...ring(590, 450, 250, 30, 2.2).slice(0, 19).reverse()]),
    st("butter", 2, line([760, 220], [790, 290], [860, 300], [800, 340], [820, 410], [760, 365], [700, 410], [720, 340], [660, 300], [730, 290], [760, 220])),
  ],
};
const heartPts: [number, number][] = Array.from({ length: 41 }, (_, i) => {
  const t = (i / 40) * Math.PI * 2;
  const x = 16 * Math.sin(t) ** 3;
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [r(500 + x * 26), r(470 - y * 26)] as [number, number];
});
const heart: NoteDraw = { strokes: [st("strawberry", 2, heartPts)] };
const house: NoteDraw = {
  strokes: [
    st("ink", 2, line([250, 520], [250, 820], [750, 820], [750, 520])),
    st("strawberry", 2, line([190, 520], [500, 230], [810, 520], [190, 520])),
    st("leaf", 2, line([440, 820], [440, 640], [560, 640], [560, 820])),
    st("sky", 2, line([300, 580], [380, 580], [380, 650], [300, 650], [300, 580])),
    st("sky", 2, line([620, 580], [700, 580], [700, 650], [620, 650], [620, 580])),
  ],
};
const flower: NoteDraw = {
  strokes: [
    st("leaf", 2, line([500, 560], [500, 900])),
    st("leaf", 2, line([500, 780], [400, 720], [330, 760], [420, 800], [500, 780])),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return st("strawberry", 2, ring(r(500 + Math.cos(a) * 150), r(400 + Math.sin(a) * 150), 80, 14));
    }),
    st("butter", 2, ring(500, 400, 70, 16)),
  ],
};
const tree: NoteDraw = {
  strokes: [
    st("ink", 2, line([450, 900], [455, 600], [545, 600], [550, 900])),
    st("leaf", 2, [...ring(500, 400, 230, 26, 0.5)]),
    st("strawberry", 1, ring(430, 360, 24, 10)),
    st("strawberry", 1, ring(560, 430, 24, 10)),
    st("strawberry", 1, ring(500, 300, 24, 10)),
  ],
};
const star: NoteDraw = {
  strokes: [
    st(
      "butter",
      2,
      Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
        return [r(500 + Math.cos(a) * 340), r(520 + Math.sin(a) * 340)] as [number, number];
      }),
    ),
    st("ink", 1, line([440, 520], [442, 522])),
    st("ink", 1, line([560, 520], [562, 522])),
    st("ink", 1, [[450, 590], [500, 625], [550, 590]]),
  ],
};
const fish: NoteDraw = {
  strokes: [
    st("sky", 2, [...ring(450, 500, 250, 30).map(([x, y]) => [r(x), r(500 + (y - 500) * 0.62)] as [number, number])]),
    st("sky", 2, line([690, 500], [880, 360], [880, 640], [690, 500])),
    st("ink", 1, line([330, 460], [332, 462])),
    st("strawberry", 1, [[260, 540], [300, 560], [340, 540]]),
    st("leaf", 1, [[450, 290], [500, 340]]),
  ],
};

/** parola → disegno (minuscole, come in WORD_DECK). */
export const PRACTICE_DRAWINGS: Record<string, NoteDraw> = {
  sole: sun,
  luna: moon,
  cuore: heart,
  casa: house,
  fiore: flower,
  albero: tree,
  stella: star,
  pesce: fish,
};
export const PRACTICE_WORDS = Object.keys(PRACTICE_DRAWINGS);
