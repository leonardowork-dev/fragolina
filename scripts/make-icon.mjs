// Genera assets/icon.png (1024), assets/splash-mark.png, assets/grain.png da SVG con @resvg/resvg-js (Windows, Mac, Linux).
// La fragola qui è lo stesso disegno della mascotte (src/design/mascot/Mascot.tsx): tienili allineati.
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (f) => path.join(root, "assets", f);
const INK = "#22121F", STRAW = "#FF2D55", DEEP = "#C4143A", LEAF = "#2FBF71", BLUSH = "#FFC2CF";

const BODY = "M110 64 C150 48 192 66 188 118 C184 170 146 214 110 222 C74 214 36 170 32 118 C28 66 70 48 110 64 Z";
const LEAVES = [
  "M110 68 C98 46 102 26 110 14 C118 26 122 46 110 68 Z",
  "M106 70 C82 70 58 60 48 42 C74 38 98 48 106 70 Z",
  "M114 70 C138 70 162 60 172 42 C146 38 122 48 114 70 Z",
  "M104 72 C78 80 54 78 40 64 C62 56 90 58 104 72 Z",
  "M116 72 C142 80 166 78 180 64 C158 56 130 58 116 72 Z",
];
const SEEDS = [[58,146],[164,146],[84,180],[136,180],[110,200],[66,106],[154,106],[110,104]];
const border = 14, sw = 5;
const all = (fill, stroke, w) => [BODY, ...LEAVES].map((d) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`).join("");

const mascot = `
  <g transform="translate(5 5)">${all(INK, INK, border + sw * 2)}</g>
  ${all(INK, INK, border + sw * 2)}
  ${all("#fff", "#fff", border)}
  <path d="${BODY}" fill="${STRAW}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>
  ${SEEDS.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="5" fill="${DEEP}" transform="rotate(${(i % 3) * 14 - 14} ${x} ${y})"/>`).join("")}
  <path d="M52 98 C56 84 68 76 82 72" stroke="#fff" stroke-opacity="0.7" stroke-width="6" stroke-linecap="round" fill="none"/>
  ${LEAVES.map((d) => `<path d="${d}" fill="${LEAF}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`).join("")}
  <ellipse cx="58" cy="148" rx="14" ry="8.5" fill="${BLUSH}"/><ellipse cx="162" cy="148" rx="14" ry="8.5" fill="${BLUSH}"/>
  <circle cx="80" cy="126" r="9" fill="${INK}"/><circle cx="140" cy="126" r="9" fill="${INK}"/>
  <circle cx="83.5" cy="122.5" r="3.2" fill="#fff"/><circle cx="143.5" cy="122.5" r="3.2" fill="#fff"/>
  <path d="M101 145 Q110 154 119 145" stroke="${INK}" stroke-width="7.5" stroke-linecap="round" fill="none"/>`;

const render = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();

// Icona: fondo rosa fragola piatto (niente gradienti), adesivo al centro, senza trasparenza.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#FFB3C1"/>
  <g transform="translate(212 170) scale(2.62)">${mascot}</g></svg>`;
fs.writeFileSync(out("icon.png"), render(icon, 1024));

// Marchio per lo splash nativo: solo la mascotte su trasparente.
const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="480" viewBox="0 0 220 240">${mascot}</svg>`;
fs.writeFileSync(out("splash-mark.png"), render(mark, 440));

// Grana di carta: 256x256, rumore frattale in nero (l'app lo mostra al ~3.5% di opacità).
const grain = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
  <filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
  <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.6 -0.3"/></filter>
  <rect width="256" height="256" filter="url(#n)"/></svg>`;
fs.writeFileSync(out("grain.png"), render(grain, 256));
console.log("assets generati: icon.png, splash-mark.png, grain.png");
