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

// ---------- Icona ----------
// Tre varianti (sessione 8). Regole dello stile "Sticker Book": fondo PIENO (niente gradienti, vetro, glow), contorno
// inchiostro e ombra dura giù-destra (già nella mascotte), nessun testo, nessuna trasparenza (iOS fa gli angoli).
const PAPER = "#FFF4F6", BUTTER = "#FFD84D", STRAW_SOFT = "#FFB3C1";
// La mascotte occupa ~(28..192, 14..222) nel suo riquadro 220×240: centro ≈ (110,118).
const place = (cx, cy, scale, rot = 0) =>
  `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${scale}) translate(-110 -120)">${mascot}</g>`;
const heart = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 14 C-22 -4 -14 -28 0 -16 C14 -28 22 -4 0 14 Z" fill="${fill}" stroke="${INK}" stroke-width="${sw * 1.1}" stroke-linejoin="round"/>`;
export const ICON_VARIANTS = {
  // 1) Rosso fragola: lo stesso fondo dello splash → icona e avvio sono un'unica cosa. L'adesivo bianco stacca il rosso.
  "1-rosso-splash": () => `<rect width="1024" height="1024" fill="${STRAW}"/>${place(512, 520, 3.35)}`,
  // 2) Carta: fondo chiaro con un cerchio rosa piatto dietro; la fragola rossa risalta al massimo.
  "2-carta": () => `<rect width="1024" height="1024" fill="${PAPER}"/><circle cx="512" cy="540" r="400" fill="${BLUSH}" stroke="${INK}" stroke-width="${sw * 3}"/>${place(512, 530, 3.1)}`,
  // 3) Burro: giallo pieno, fragola un po' inclinata, due cuoricini adesivo.
  "3-burro": () => `<rect width="1024" height="1024" fill="${BUTTER}"/>${place(512, 530, 3.2, -7)}${heart(190, 214, 3.2, BLUSH)}${heart(846, 818, 2.6, STRAW)}`,
};
const CHOSEN = "1-rosso-splash"; // scelta e motivazione: DECISIONS.md, sessione 8
const iconSvg = (name) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${ICON_VARIANTS[name]()}</svg>`;

if (process.argv.includes("--variants")) {
  // Anteprime in docs/shots/session8/icon/: ogni variante a 1024, a 60 pt e 29 pt (@3x), e tutte su una finta Home.
  const dir = path.join(root, "docs", "shots", "session8", "icon");
  fs.mkdirSync(dir, { recursive: true });
  const pngs = {};
  for (const name of Object.keys(ICON_VARIANTS)) {
    pngs[name] = render(iconSvg(name), 1024);
    fs.writeFileSync(path.join(dir, `${name}.png`), pngs[name]);
  }
  const uri = (b) => `data:image/png;base64,${b.toString("base64")}`;
  const names = Object.keys(ICON_VARIANTS);
  // finta Home 390×844 @3x: sfondo sfumato scuro NO (solo pieno), 4 colonne, accanto a icone "vicine" di colore diverso
  const neighbours = ["#4F8EF7", "#34C759", "#AF52DE", "#FF9500", "#5AC8FA", "#FF3B30", "#8E8E93", "#FFCC00"];
  const cell = (i, col, row, fill, img, label) => {
    const x = 28 + col * 88, y = 80 + row * 100;
    const body = img ? `<image href="${uri(img)}" x="${x}" y="${y}" width="60" height="60" clip-path="url(#r${i})"/>` : `<rect x="${x}" y="${y}" width="60" height="60" rx="13.4" fill="${fill}"/>`;
    return `<clipPath id="r${i}"><rect x="${x}" y="${y}" width="60" height="60" rx="13.4"/></clipPath>${body}<text x="${x + 30}" y="${y + 76}" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#fff" text-anchor="middle">${label}</text>`;
  };
  names.forEach((name, k) => {
    let cells = "";
    let n = 0;
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
      const iconHere = row === 1 && col === 2;
      cells += cell(++n, col, row, neighbours[(row * 4 + col) % neighbours.length], iconHere ? pngs[name] : null, iconHere ? "Fragolina" : "App");
    }
    const home = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="640" viewBox="0 0 390 640"><rect width="390" height="640" fill="#1D2B4F"/>${cells}</svg>`;
    fs.writeFileSync(path.join(dir, `${name}-home.png`), new Resvg(home, { fitTo: { mode: "width", value: 780 } }).render().asPng());
    for (const [pt, label] of [[60, "60pt"], [29, "29pt"]]) {
      const px = pt * 3;
      const small = new Resvg(iconSvg(name), { fitTo: { mode: "width", value: px } }).render().asPng();
      fs.writeFileSync(path.join(dir, `${name}-${label}.png`), small);
    }
  });
  // striscia di confronto: le tre a 180 px e a 87 px affiancate (ingrandite ×3 per vederle)
  const strip = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520"><rect width="1200" height="520" fill="#1D2B4F"/>${names
    .map((nm, i) => `<image href="${uri(new Resvg(iconSvg(nm), { fitTo: { mode: "width", value: 180 } }).render().asPng())}" x="${60 + i * 380}" y="40" width="360" height="360" style="image-rendering:pixelated"/>`)
    .join("")}${names
    .map((nm, i) => `<image href="${uri(new Resvg(iconSvg(nm), { fitTo: { mode: "width", value: 87 } }).render().asPng())}" x="${60 + i * 380}" y="420" width="87" height="87"/>`)
    .join("")}</svg>`;
  fs.writeFileSync(path.join(dir, "confronto.png"), new Resvg(strip, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
  console.log(`anteprime icona in ${dir}`);
  process.exit(0);
}

fs.writeFileSync(out("icon.png"), render(iconSvg(CHOSEN), 1024));

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
