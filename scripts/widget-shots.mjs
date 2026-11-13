// Screenshot dell'anteprima web dei widget (rotta nascosta /widget-preview) con Playwright.
// Uso: avvia `npm run web` (porta 8081, o PREVIEW_URL), poi `node scripts/widget-shots.mjs [tag]`.
// Output: docs/shots/<tag>/widget-<caso>.png (un file per caso) e un riepilogo delle segnalazioni
// (testo troncato / riquadro troppo pieno). Esce con codice 1 se ci sono segnalazioni e WIDGET_STRICT=1.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const tag = process.argv[2] ?? "widgets";
const only = process.argv[3]; // facoltativo: id di un solo caso
const outDir = path.join(root, "docs", "shots", tag);
fs.mkdirSync(outDir, { recursive: true });

const pw = path.join(os.homedir(), ".cache", "ms-playwright");
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"];
if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter((n) => n.startsWith("chromium-"))) candidates.push(path.join(pw, d, "chrome-linux64", "chrome"));
const exe = candidates.find((c) => c && fs.existsSync(c));
if (!exe) throw new Error("Nessun browser: imposta CHROME_PATH");

const settings = { state: { onboardingDone: true, haptics: true, reduceMotionOverride: true, darkOverride: false }, version: 0 };
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], env: { ...process.env, LD_LIBRARY_PATH: process.env.CHROME_LIBS ? `${process.env.CHROME_LIBS}:${process.env.LD_LIBRARY_PATH ?? ""}` : process.env.LD_LIBRARY_PATH } });
const ctx = await browser.newContext({ viewport: { width: 760, height: 2600 }, deviceScaleFactor: 2 });
// In anteprima web gli archivi hanno un suffisso per scheda (src/lib/tabScope.ts): lo fissiamo.
await ctx.addInitScript((s) => {
  sessionStorage.setItem("fragolina.mock.scope", "shots");
  localStorage.setItem("fragolina.settings.v1.shots", s);
}, JSON.stringify(settings));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/widget-preview", { waitUntil: "networkidle" });
try {
  await page.waitForSelector('[data-testid="flags"]', { timeout: 45000 });
} catch (e) {
  await page.screenshot({ path: path.join(outDir, "_errore.png") });
  console.log("pagina:", page.url(), (await page.innerText("body")).slice(0, 300), errors);
  throw e;
}
await page.waitForTimeout(2500);
const ids = await page.$$eval('[data-testid^="case-"]', (els) => els.map((e) => e.getAttribute("data-testid").slice(5)));
for (const id of ids) {
  if (only && id !== only) continue;
  const el = await page.$(`[data-testid="case-${id}"]`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await el.screenshot({ path: path.join(outDir, `widget-${id}.png`) });
}
const flags = await page.evaluate(() => globalThis.__widgetFlags ?? []);
console.log(`casi: ${ids.length} · segnalazioni: ${flags.length}`);
for (const f of flags) console.log("  -", f);
if (errors.length) console.log("errori JS:", errors.slice(0, 5));
await browser.close();
process.exit(flags.length && process.env.WIDGET_STRICT === "1" ? 1 : 0);
