// Screenshot headless dell'anteprima web nelle dimensioni iPhone. Windows/Mac/Linux.
// Uso: avvia prima `npm run web` (porta 8081), poi `npm run preview-shots [tag]`. Output: docs/shots/<tag>/*.png
// Browser: usa CHROME_PATH se impostato, altrimenti Chrome/Edge di Windows, altrimenti Chromium di Playwright.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const tag = process.argv[2] ?? "latest";
const outDir = path.join(root, "docs", "shots", tag);
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const home = os.homedir();
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const pw = path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(pw)) {
    for (const d of fs.readdirSync(pw).filter((n) => n.startsWith("chromium-"))) {
      candidates.push(path.join(pw, d, "chrome-linux64", "chrome"));
    }
  }
  const found = candidates.find((c) => c && fs.existsSync(c));
  if (!found) throw new Error("Nessun browser trovato. Imposta CHROME_PATH al percorso di chrome.exe / msedge.exe.");
  return found;
}

const SIZES = [
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "360", width: 360, height: 740 },
];
const ONBOARDED = JSON.stringify({ state: { onboardingDone: true, haptics: true, reduceMotionOverride: null, darkOverride: false }, version: 0 });
const settle = (page, ms = 900) => page.waitForTimeout(ms);

async function shot(page, name, size) {
  await page.screenshot({ path: path.join(outDir, `${name}-${size.name}.png`) });
}

const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--no-sandbox", "--allow-file-access-from-files"] });
const log = [];

for (const size of SIZES) {
  // 1) Onboarding (storage vuoto)
  {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => log.push(`[${size.name}] pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && log.push(`[${size.name}] console: ${m.text()}`));
    await page.goto(base, { waitUntil: "networkidle" });
    await settle(page, 2200);
    await shot(page, "onboarding-1", size);
    await page.getByRole("button", { name: "Avanti" }).first().click();
    await settle(page, 900);
    await shot(page, "onboarding-2", size);
    await page.getByLabel("Codice di coppia").fill("FRA123");
    await page.getByRole("button", { name: "Collega" }).first().click();
    await settle(page, 600);
    await shot(page, "onboarding-2-ok", size);
    await page.getByRole("button", { name: "Avanti" }).first().click();
    await settle(page, 700);
    await shot(page, "onboarding-3", size);
    await ctx.close();
  }
  // 2) App con onboarding completato
  {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript((v) => localStorage.setItem("fragolina.settings.v1", v), ONBOARDED);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => log.push(`[${size.name}] pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && log.push(`[${size.name}] console: ${m.text()}`));
    const routes = [["home", "/"], ["pet", "/pet"], ["draw", "/draw"], ["play", "/play"], ["us", "/us"], ["design-lab", "/design-lab"]];
    for (const [name, route] of routes) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      await settle(page, name === "home" ? 2400 : 1500);
      await shot(page, name, size);
    }
    if (size.name === "390") {
      // Home: sheet umore e "Penso a te" + schermate lunghe intere
      await page.goto(base + "/", { waitUntil: "networkidle" });
      await settle(page, 2200);
      await page.getByRole("button", { name: /Umore di/ }).click();
      await settle(page, 900);
      await shot(page, "home-mood-sheet", size);
      await page.keyboard.press("Escape");
      await page.mouse.click(200, 60);
      await settle(page, 700);
      await page.getByRole("button", { name: /Penso a te a/ }).click();
      await page.waitForTimeout(380);
      await shot(page, "home-hearts", size);
      await settle(page, 1500);
      for (const [name, route] of [["home", "/"], ["us", "/us"], ["design-lab", "/design-lab"], ["play", "/play"]]) {
        await page.setViewportSize({ width: size.width, height: name === "design-lab" ? 5200 : 1500 });
        await page.goto(base + route, { waitUntil: "networkidle" });
        await settle(page, 1800);
        await page.screenshot({ path: path.join(outDir, `${name}-tall-${size.name}.png`) });
        await page.setViewportSize({ width: size.width, height: size.height });
      }
      // Disegno: un tratto finto sulla tela
      await page.goto(base + "/draw", { waitUntil: "networkidle" });
      await settle(page, 2200);
      await page.mouse.move(80, 200);
      await page.mouse.down();
      for (let i = 0; i < 24; i++) await page.mouse.move(80 + i * 10, 200 + Math.sin(i / 2.5) * 60);
      await page.mouse.up();
      await settle(page, 500);
      await shot(page, "draw-stroke", size);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "console.log"), log.join("\n") || "nessun errore");
console.log(`Screenshot in ${outDir}\n${log.slice(0, 20).join("\n") || "nessun errore in console"}`);
