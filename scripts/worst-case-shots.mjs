// Prova "caso peggiore": nomi lunghissimi, contatore enorme, zero giorni, dati mancanti. Output in docs/shots/<tag>/.
// Uso: avvia `npm run web`, poi `node scripts/worst-case-shots.mjs worst`.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const tag = process.argv[2] ?? "worst";
const outDir = path.join(root, "docs", "shots", tag);
fs.mkdirSync(outDir, { recursive: true });
const pw = path.join(os.homedir(), ".cache", "ms-playwright");
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"];
if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter((n) => n.startsWith("chromium-"))) candidates.push(path.join(pw, d, "chrome-linux64", "chrome"));
const exe = candidates.find((c) => c && fs.existsSync(c));
if (!exe) throw new Error("Nessun browser: imposta CHROME_PATH");

const settings = { state: { onboardingDone: true, haptics: true, reduceMotionOverride: null, darkOverride: false }, version: 0 };
const today = new Date();
const future = `${today.getFullYear() + 1}-01-01`;
const cases = {
  "lunghi-enorme": { meName: "Massimiliano Alessandro Bartolomeo", partnerName: "Maria-Chiara Anna Francesca Rossi De Santis", startDate: "1900-01-01" },
  "zero-giorni": { meName: "Leo", partnerName: "N", startDate: future },
  "un-giorno-quattro-cifre": { meName: "Leonardo", partnerName: "Nikole", startDate: "2012-03-09" },
};
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
for (const [name, c] of Object.entries(cases)) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(([s, couple]) => {
    localStorage.setItem("fragolina.settings.v1", s);
    localStorage.setItem("fragolina.couple.v1", couple);
  }, [JSON.stringify(settings), JSON.stringify({ state: { ...c, partnerMood: "stressata", partnerMoodAt: 0, thoughtsSentToday: 128, thoughtsDay: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`, thoughtsReceivedTotal: 0, lastThoughtAt: null, question: { id: "q", myAnswer: "b", partnerAnswer: null } }, version: 0 })]);
  const page = await ctx.newPage();
  for (const [r, route] of [["home", "/"], ["us", "/us"]]) {
    await page.setViewportSize({ width: 360, height: 1500 });
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await page.screenshot({ path: path.join(outDir, `${name}-${r}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log("fatto:", outDir);
