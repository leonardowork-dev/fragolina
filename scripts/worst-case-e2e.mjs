// Caso peggiore con la prova a due schede: nomi lunghi, 10.000 pensieri, 36.000 giorni, partner che non ha mai risposto.
// Uso: avvia `npm run web`, poi  W=360 H=740 npm run worst-e2e  → docs/shots/session2/worst-<W>/
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const W = Number(process.env.W ?? 360);
const H = Number(process.env.H ?? 740);
const outDir = path.join(root, "docs", "shots", "session2", `worst-${W}`);
fs.mkdirSync(outDir, { recursive: true });
const pw = path.join(os.homedir(), ".cache", "ms-playwright");
const exe = process.env.CHROME_PATH ?? fs.readdirSync(pw).filter((n) => n.startsWith("chromium-")).map((d) => path.join(pw, d, "chrome-linux64", "chrome"))[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"], env: { ...process.env, LD_LIBRARY_PATH: process.env.CHROME_LIBS ?? "" } });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const A = await ctx.newPage();
const B = await ctx.newPage();
const errors = [];
for (const p of [A, B]) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text()));
}
const btn = (p, name) => p.getByRole("button", { name }).first();
const settle = (p, ms = 800) => p.waitForTimeout(ms);
let n = 0;
const shot = (p, name, full = false) => p.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: full });

const LONG_A = "Bartolomeo Alessandro M."; // 24 caratteri
const LONG_B = "Maria-Chiara dell'Orto Z"; // 24 caratteri
await Promise.all([A.goto(base, { waitUntil: "networkidle" }), B.goto(base, { waitUntil: "networkidle" })]);
await settle(A, 2500);
for (const p of [A, B]) await btn(p, "Avanti").click();
await A.getByLabel("Il tuo nome").fill(LONG_A);
await B.getByLabel("Il tuo nome").fill(LONG_B);
await btn(A, "Crea il nostro posto").click();
await A.getByLabel(/Il vostro codice:/).first().waitFor();
const code = ((await A.getByLabel(/Il vostro codice:/).first().getAttribute("aria-label")) ?? "").replace(/^.*:\s*/, "").replace(/\s+/g, "");
await btn(B, "Ho un codice").click();
await B.getByLabel("Codice di coppia").fill(code);
await btn(B, "Entra").click();
await B.getByText(/Eccovi\./).first().waitFor({ timeout: 15000 });
await settle(A, 1500);
for (const p of [A, B]) {
  await btn(p, "Avanti").click();
  await settle(p, 500);
  await btn(p, "Entra").click();
  await settle(p, 1200);
}
// Dati estremi direttamente nel finto server (condiviso): 10.000 pensieri di B ad A, data 1926, umore e nessuna risposta di B
await A.evaluate(() => {
  const k = "fragolina.mock.server.v1";
  const s = JSON.parse(localStorage.getItem(k));
  const c = Object.values(s.couples)[0];
  const [ua, ub] = [s.members.find((m) => m.role === "a").userId, s.members.find((m) => m.role === "b").userId];
  const now = Date.now();
  for (let i = 0; i < 10000; i++) s.pings.push({ id: "p" + i, coupleId: c.id, fromUser: ub, key: "k" + i, at: now - (10000 - i) * 1000 });
  for (let i = 0; i < 9999; i++) s.pings.push({ id: "q" + i, coupleId: c.id, fromUser: ua, key: "kk" + i, at: now - 50 - i });
  c.startDate = "1926-01-01";
  c.startDateAt = now;
  s.moods.push({ coupleId: c.id, userId: ub, moodId: "voglia", key: "m", at: now });
  s.moods[s.moods.length - 1].moodId = "coccole";
  localStorage.setItem(k, JSON.stringify(s));
});
await A.reload({ waitUntil: "networkidle" });
await B.reload({ waitUntil: "networkidle" });
await settle(A, 3000);
await settle(B, 1000);
await shot(A, "A-home-estrema");
await shot(B, "B-home-estrema");
await A.setViewportSize({ width: W, height: 1700 });
await settle(A, 800);
await shot(A, "A-home-intera", true);
await A.getByRole("tab", { name: "Noi" }).click();
await settle(A, 1000);
await shot(A, "A-noi-intera", true);
await A.setViewportSize({ width: W, height: H });
await browser.close();
console.log(`Screenshot in ${outDir}\n${errors.slice(0, 5).join("\n") || "nessun errore in console"}`);
process.exit(errors.length ? 1 : 0);
