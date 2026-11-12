import { Platform } from "react-native";

/**
 * Simula `lineLimit(n)` + `minimumScaleFactor(m)` di SwiftUI nell'anteprima web: misura il testo con il canvas
 * (font caricati) e sceglie la grandezza più grande ≥ size*minScale che entra in `maxLines` righe di larghezza `maxW`.
 * Se nemmeno al minimo entra, tronca con "…" (come SwiftUI). Solo anteprima: sul telefono ci pensa SwiftUI.
 */
let ctx: CanvasRenderingContext2D | null = null;
function measure(text: string, family: string, size: number, tracking: number): number {
  if (Platform.OS !== "web" || typeof document === "undefined") return text.length * size * 0.55;
  ctx = ctx ?? document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.55;
  ctx.font = `${size}px ${family}`;
  return ctx.measureText(text).width + tracking * text.length;
}

function wrap(text: string, family: string, size: number, tracking: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, family, size, tracking) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export type Fitted = { size: number; lines: string[]; truncated: boolean; scale: number };

export function fitText(
  text: string,
  family: string,
  size: number,
  maxW: number,
  maxLines: number,
  minScale: number,
  tracking = 0,
): Fitted {
  for (let s = 1; s >= minScale - 1e-6; s -= 0.02) {
    const sz = size * s;
    const lines = wrap(text, family, sz, tracking * s, maxW);
    // una parola più larga della riga non si spezza: deve entrare intera
    const fits = lines.length <= maxLines && lines.every((l) => measure(l, family, sz, tracking * s) <= maxW + 0.5);
    if (fits) return { size: sz, lines, truncated: false, scale: s };
  }
  const sz = size * minScale;
  let lines = wrap(text, family, sz, tracking * minScale, maxW).slice(0, maxLines);
  const last = lines.length - 1;
  let t = lines[last] ?? "";
  while (t.length > 1 && measure(t + "…", family, sz, tracking * minScale) > maxW) t = t.slice(0, -1);
  lines = [...lines.slice(0, last), t + "…"];
  return { size: sz, lines, truncated: true, scale: minScale };
}
