import { describe, expect, it } from "vitest";

import { distanceView, groupThousands, haversineKm, roundE2, validE2 } from "@/lib/geo/distance";
import {
  NOTE_MAX_BYTES,
  NOTE_MAX_POINTS,
  type RawStroke,
  buildDraw,
  cleanText,
  contentBytes,
  minutesLeft,
  noteState,
  pointCount,
  pointsFromSvg,
  rdp,
  validateContent,
} from "@/lib/note/rules";

describe("Ramer-Douglas-Peucker", () => {
  it("una linea retta si riduce a due punti; gli estremi restano", () => {
    const line: [number, number][] = Array.from({ length: 50 }, (_, i) => [i * 10, i * 10]);
    expect(rdp(line, 1)).toEqual([line[0], line[49]]);
  });
  it("un angolo si conserva", () => {
    const pts: [number, number][] = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100]];
    expect(rdp(pts, 2)).toEqual([[0, 0], [100, 0], [100, 100]]);
  });
  it("tratti lunghissimi non esauriscono lo stack", () => {
    const pts: [number, number][] = Array.from({ length: 50000 }, (_, i) => [i % 1000, Math.floor(Math.sin(i) * 400 + 500)]);
    expect(rdp(pts, 3).length).toBeGreaterThan(2);
  });
});

describe("dal pennarello al biglietto", () => {
  it("legge i punti dello SVG di Skia", () => {
    expect(pointsFromSvg("M10 20L30.5 40L50 60")).toEqual([[10, 20], [30.5, 40], [50, 60]]);
    expect(pointsFromSvg("M 1e1 -2 L 3 4")).toEqual([[10, -2], [3, 4]]);
    expect(pointsFromSvg("")).toEqual([]);
  });
  it("normalizza a 0-1000 e un tocco diventa un puntino valido", () => {
    const d = buildDraw([{ points: [[170, 85]], color: "sky", thick: false }], 340);
    expect(d.strokes[0].p).toEqual([[500, 250], [500, 250]]);
    expect(validateContent("draw", d)).toBeNull();
  });
  it("coordinate fuori tela vengono ricondotte dentro", () => {
    const d = buildDraw([{ points: [[-50, 400], [900, 10]], color: "ink", thick: true }], 340);
    for (const q of d.strokes[0].p) for (const v of q) expect(v >= 0 && v <= 1000).toBe(true);
  });
  it("un tracciato scarabocchiato enorme viene semplificato dentro i limiti (≤ 1500 punti, ≤ 24 KB) e resta valido", () => {
    const strokes: RawStroke[] = Array.from({ length: 40 }, (_, k) => ({
      color: "strawberry",
      thick: k % 2 === 0,
      points: Array.from({ length: 2000 }, (_, i) => [170 + Math.sin(i / 7 + k) * 160 * Math.cos(i / 53), 170 + Math.cos(i / 5) * 160 * Math.sin(i / 71 + k)] as [number, number]),
    }));
    const d = buildDraw(strokes, 340);
    expect(pointCount(d)).toBeLessThanOrEqual(NOTE_MAX_POINTS);
    expect(contentBytes(d)).toBeLessThanOrEqual(NOTE_MAX_BYTES);
    expect(validateContent("draw", d)).toBeNull();
    expect(d.strokes.length).toBe(40);
  });
  it("più di 40 tratti: restano gli ultimi 40", () => {
    const strokes: RawStroke[] = Array.from({ length: 55 }, (_, i) => ({ color: "ink", thick: false, points: [[i, i], [i + 5, i + 5]] }));
    expect(buildDraw(strokes, 340).strokes.length).toBe(40);
  });
});

describe("regole del contenuto (specchio del server)", () => {
  it("scritta: 1-80 caratteri (anche emoji = 1), sfondo della palette", () => {
    expect(validateContent("text", { text: "ciao", bg: "sky" })).toBeNull();
    expect(validateContent("text", { text: "🍓".repeat(80), bg: "sky" })).toBeNull();
    expect(validateContent("text", { text: "x".repeat(81), bg: "sky" })).not.toBeNull();
    expect(validateContent("text", { text: "  ", bg: "sky" })).not.toBeNull();
    expect(validateContent("text", { text: "a", bg: "viola" })).not.toBeNull();
  });
  it("cleanText comprime gli spazi e taglia a 80", () => {
    expect(cleanText("  a   b \n c ")).toBe("a b c");
    expect([...cleanText("y".repeat(200))].length).toBe(80);
  });
  it("disegno: colore e spessore della palette, interi 0-1000", () => {
    const ok = { strokes: [{ c: "leaf", w: 2, p: [[0, 0], [1000, 1000]] }] };
    expect(validateContent("draw", ok)).toBeNull();
    for (const bad of [
      { strokes: [{ c: "viola", w: 1, p: [[1, 1]] }] },
      { strokes: [{ c: "ink", w: 3, p: [[1, 1]] }] },
      { strokes: [{ c: "ink", w: 1, p: [[1.5, 1]] }] },
      { strokes: [{ c: "ink", w: 1, p: [[1, 1001]] }] },
      { strokes: [] },
      null,
    ])
      expect(validateContent("draw", bad)).not.toBeNull();
  });
  it("stato e minuti", () => {
    const n = { expiresAt: 3_600_000, clearedAt: null };
    expect(noteState(n, 0)).toBe("active");
    expect(noteState(n, 3_599_999)).toBe("active");
    expect(noteState(n, 3_600_000)).toBe("expired");
    expect(noteState({ ...n, clearedAt: 5 }, 0)).toBe("cleared");
    expect(minutesLeft(n, 0)).toBe(60);
    expect(minutesLeft(n, 3_540_001)).toBe(1);
    expect(minutesLeft(n, 4_000_000)).toBe(0);
  });
});

describe("distanza", () => {
  const roma = { latE2: 4190, lonE2: 1250 };
  it("arrotondamento al centesimo di grado (≈ 1 km)", () => {
    expect(roundE2(41.9028)).toBe(4190);
    expect(roundE2(-12.4964)).toBe(-1250);
    expect(validE2({ latE2: 9000, lonE2: -18000 })).toBe(true);
    expect(validE2({ latE2: 9001, lonE2: 0 })).toBe(false);
    expect(validE2({ latE2: 1.5, lonE2: 0 })).toBe(false);
  });
  it("haversine: casi noti", () => {
    expect(haversineKm(roma, roma)).toBe(0);
    expect(haversineKm(roma, { latE2: 4546, lonE2: 919 })).toBeGreaterThan(470);
    expect(haversineKm(roma, { latE2: 4546, lonE2: 919 })).toBeLessThan(490);
    expect(haversineKm({ latE2: 0, lonE2: 0 }, { latE2: 0, lonE2: 18000 })).toBeCloseTo(20015, -1);
    expect(haversineKm({ latE2: 9000, lonE2: 0 }, { latE2: -9000, lonE2: 0 })).toBeCloseTo(20015, -1);
  });
  it("testi: 'a 342 km', 'a 2 km', 'vicinissimi' sotto 2 km, '19.000 km'", () => {
    expect(distanceView(342.4).sentence).toBe("a 342 km");
    expect(distanceView(2).sentence).toBe("a 2 km");
    expect(distanceView(1.99).sentence).toBe("vicinissimi");
    expect(distanceView(0).sentence).toBe("vicinissimi");
    expect(distanceView(19000).sentence).toBe("a 19.000 km");
    expect(distanceView(19012.6).big).toBe("19.013");
    expect(groupThousands(1234567)).toBe("1.234.567");
  });
});
