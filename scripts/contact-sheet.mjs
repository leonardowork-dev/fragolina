// Unisce gli screenshot di una cartella in fogli da 3 colonne per la revisione (usa Chromium di Playwright).
// Uso: node scripts/contact-sheet.mjs <cartella> [da] [a]
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = path.resolve(process.argv[2]);
const all = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f)).sort();
const lo = Number(process.argv[3] ?? 1);
const hi = Number(process.argv[4] ?? all.length);
const files = all.slice(lo - 1, hi);
const pw = path.join(os.homedir(), ".cache", "ms-playwright");
const exe = fs.readdirSync(pw).filter((n) => n.startsWith("chromium-")).map((d) => path.join(pw, d, "chrome-linux64", "chrome"))[0];
const html = `<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(3,${Number(process.env.CW ?? 390)}px);gap:6px;font:12px sans-serif">${files
  .map((f) => `<figure style="margin:0"><div>${f}</div><img style="width:100%" src="file://${path.join(dir, f)}"></figure>`)
  .join("")}</body>`;
const tmp = path.join(dir, "_sheet.html");
fs.writeFileSync(tmp, html);
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--allow-file-access-from-files"], env: { ...process.env, LD_LIBRARY_PATH: process.env.CHROME_LIBS ?? "" } });
const p = await b.newPage({ viewport: { width: 3 * Number(process.env.CW ?? 390) + 12, height: 800 } });
await p.goto("file://" + tmp);
await p.waitForTimeout(500);
const out = path.join(dir, `_sheet-${lo}-${hi}.png`);
await p.screenshot({ path: out, fullPage: true });
await b.close();
fs.rmSync(tmp);
console.log(out);
