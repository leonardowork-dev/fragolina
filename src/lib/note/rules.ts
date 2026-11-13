/**
 * Il "biglietto": un disegno o una scritta che resta sul widget dell'altra persona (e sul tuo) per un'ora.
 * Funzioni PURE (app, anteprima web e prove). Il widget Swift legge lo stesso contenuto (targets/widget/Model.swift,
 * `NoteContent`); lo specchio SQL è `_note_valid` in supabase/migrations/20261114000001_note.sql.
 *
 * Il disegno viaggia come VETTORI, mai come immagine: tratti con punti interi 0-1000 (coordinate normalizzate 0-1
 * sulla tela quadrata, per mille), colore = nome della palette, spessore 1 (fine) o 2 (spesso). Così il widget lo
 * ridisegna nitido in ogni misura e, sul blocco, in monocromatico.
 */

export const NOTE_TTL_MS = 60 * 60 * 1000;
export const NOTE_TEXT_MAX = 80;
export const NOTE_MAX_BYTES = 24 * 1024;
export const NOTE_MAX_POINTS = 1500;
export const NOTE_MAX_STROKES = 40;
export const NOTE_MAX_STROKE_POINTS = 400;
export const NOTE_GRID = 1000;

export const INK_KEYS = ["ink", "strawberry", "leaf", "sky", "butter"] as const;
export type InkKey = (typeof INK_KEYS)[number];
export const BG_KEYS = ["butter", "blush", "sky", "leaf", "strawberry", "paper"] as const;
export type BgKey = (typeof BG_KEYS)[number];

export type NoteStroke = { c: InkKey; w: 1 | 2; p: [number, number][] };
export type NoteDraw = { strokes: NoteStroke[] };
export type NoteText = { text: string; bg: BgKey };
export type NoteKind = "draw" | "text";
export type NoteContent = NoteDraw | NoteText;

/** Il biglietto come lo vedono app e widget. `by` è relativo a chi guarda. */
export type Note = {
  id: string;
  kind: NoteKind;
  content: NoteContent;
  by: "me" | "partner";
  byName: string;
  createdAt: number;
  expiresAt: number;
  clearedAt: number | null;
  /** Ancora in coda sul telefono (non ancora confermato dal server). */
  pending?: boolean;
};

export type NoteState = "active" | "expired" | "cleared";

export function noteState(n: Pick<Note, "expiresAt" | "clearedAt">, now: number): NoteState {
  if (n.clearedAt !== null) return "cleared";
  return now >= n.expiresAt ? "expired" : "active";
}

/** Minuti interi che restano (arrotondati per eccesso, almeno 1 finché è attivo). */
export function minutesLeft(n: Pick<Note, "expiresAt">, now: number): number {
  return Math.max(0, Math.ceil((n.expiresAt - now) / 60000));
}

/** Colore del testo su ogni sfondo: inchiostro ovunque, carta sulla fragola (stessi contrasti dei token). */
export const textInkFor = (bg: BgKey): "ink" | "paper" => (bg === "strawberry" ? "paper" : "ink");

export const isDraw = (c: NoteContent): c is NoteDraw => "strokes" in c;
export const isText = (c: NoteContent): c is NoteText => "text" in c;

export const contentBytes = (c: NoteContent) => JSON.stringify(c).length;
export const pointCount = (d: NoteDraw) => d.strokes.reduce((n, s) => n + s.p.length, 0);

/** Stesse regole del server: `null` = valido, altrimenti il motivo. */
export function validateContent(kind: NoteKind, c: unknown): string | null {
  if (typeof c !== "object" || c === null) return "contenuto";
  if (kind === "text") {
    const t = (c as NoteText).text;
    const bg = (c as NoteText).bg;
    if (typeof t !== "string") return "testo";
    const trimmed = t.trim();
    if (trimmed.length < 1 || [...t].length > NOTE_TEXT_MAX) return "lunghezza";
    if (!BG_KEYS.includes(bg)) return "sfondo";
    return null;
  }
  const strokes = (c as NoteDraw).strokes;
  if (!Array.isArray(strokes) || strokes.length < 1 || strokes.length > NOTE_MAX_STROKES) return "tratti";
  let points = 0;
  for (const s of strokes) {
    if (!INK_KEYS.includes(s?.c) || (s?.w !== 1 && s?.w !== 2) || !Array.isArray(s?.p)) return "tratto";
    if (s.p.length < 1 || s.p.length > NOTE_MAX_STROKE_POINTS) return "punti";
    for (const q of s.p) {
      if (!Array.isArray(q) || q.length !== 2) return "punto";
      for (const v of q) if (!Number.isInteger(v) || v < 0 || v > NOTE_GRID) return "coordinata";
    }
    points += s.p.length;
  }
  if (points > NOTE_MAX_POINTS) return "troppi punti";
  if (contentBytes(c as NoteDraw) > NOTE_MAX_BYTES) return "troppo grande";
  return null;
}

// ---------- Dal pennarello al contenuto ----------

/** Punti dello SVG di Skia (`M x y L x y …`, solo linee: è come costruiamo il tratto). */
export function pointsFromSvg(svg: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /[ML]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)[\s,]+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi;
  for (const m of svg.matchAll(re)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

/** Distanza di un punto dal segmento a-b (Ramer-Douglas-Peucker). */
function segDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer-Douglas-Peucker iterativo (nessuna ricorsione profonda sui tratti lunghi). Tiene sempre il primo e l'ultimo. */
export function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist(pts[i], pts[lo], pts[hi]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > eps && at > 0) {
      keep[at] = 1;
      stack.push([lo, at], [at, hi]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

export type RawStroke = { points: [number, number][]; color: InkKey; thick: boolean };

const clampInt = (v: number) => Math.max(0, Math.min(NOTE_GRID, Math.round(v)));

/**
 * Tratti in pixel → contenuto del biglietto. `size` = lato della tela quadrata in pixel. Parte con una
 * semplificazione leggera (3 su 1000) e la aumenta finché il disegno sta nei limiti (24 KB, 1500 punti): i tratti
 * restano riconoscibili, i punti inutili spariscono.
 */
export function buildDraw(strokes: RawStroke[], size: number): NoteDraw {
  const norm = strokes
    .filter((s) => s.points.length > 0)
    .slice(-NOTE_MAX_STROKES)
    .map((s) => ({
      c: s.color,
      w: (s.thick ? 2 : 1) as 1 | 2,
      p: s.points.map(([x, y]) => [clampInt((x / size) * NOTE_GRID), clampInt((y / size) * NOTE_GRID)] as [number, number]),
    }));
  let eps = 3;
  for (let i = 0; i < 14; i++) {
    const strokesOut: NoteStroke[] = norm.map((s) => ({
      c: s.c,
      w: s.w,
      p: dedupe(rdp(s.p, eps)).slice(0, NOTE_MAX_STROKE_POINTS),
    }));
    const d: NoteDraw = { strokes: strokesOut };
    if (pointCount(d) <= NOTE_MAX_POINTS && contentBytes(d) <= NOTE_MAX_BYTES) return d;
    eps *= 1.6;
  }
  // ultima risorsa: un campionamento secco (non dovrebbe mai servire con 40 tratti × 400 punti)
  return {
    strokes: norm.map((s) => ({ c: s.c, w: s.w, p: s.p.filter((_, i) => i % 4 === 0 || i === s.p.length - 1).slice(0, 30) })),
  };
}

function dedupe(p: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const q of p) {
    const l = out[out.length - 1];
    if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q);
  }
  // un solo punto (un tocco) diventa un puntino: due punti uguali, così ogni tratto ha una linea da disegnare
  if (out.length === 1) out.push([out[0][0], out[0][1]]);
  return out;
}

export function cleanText(t: string): string {
  return [...t.replace(/\s+/g, " ").trim()].slice(0, NOTE_TEXT_MAX).join("");
}

/** Una riga della tabella `notes` (tempo reale). */
export type NoteRow = {
  id: string;
  kind: NoteKind;
  content: NoteContent;
  userId: string;
  createdAt: number;
  expiresAt: number;
  clearedAt: number | null;
};
