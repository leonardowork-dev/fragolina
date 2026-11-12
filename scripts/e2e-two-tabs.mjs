// Prova a DUE SCHEDE nel browser: ogni scheda è un telefono (identità per scheda), il finto server è condiviso.
// Uso: avvia `npm run web` (porta 8081), poi  ROUND=1 npm run e2e   → screenshot in docs/shots/session2/r<ROUND>/
// Stampa una tabella PASS/FAIL. Nessun servizio a pagamento: solo Chromium via playwright-core.
import { chromium } from "playwright-core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const round = process.env.ROUND ?? "1";
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const outDir = path.join(root, "docs", "shots", "session2", `r${round}${W === 390 ? "" : "-" + W}`);
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const home = os.homedir();
  const c = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const pw = path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter((n) => n.startsWith("chromium-"))) c.push(path.join(pw, d, "chrome-linux64", "chrome"));
  const f = c.find((x) => x && fs.existsSync(x));
  if (!f) throw new Error("Nessun browser: imposta CHROME_PATH.");
  return f;
}

const rows = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  rows.push([ok ? "PASS" : "FAIL", name, ok ? "" : detail]);
  if (!ok) failed++;
};
const errors = [];
const settle = (p, ms = 700) => p.waitForTimeout(ms);
let n = 0;
const shot = async (page, who, name) => {
  n++;
  await page.screenshot({ path: path.join(outDir, `${String(n).padStart(2, "0")}-${who}-${name}.png`) });
};
const seen = async (page, matcher, timeout = 15000) => {
  try {
    await page.getByText(matcher).first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
};
const btn = (page, name) => page.getByRole("button", { name }).first();

const browser = await chromium.launch({ executablePath: findBrowser(), args: ["--no-sandbox"], env: { ...process.env, LD_LIBRARY_PATH: [process.env.CHROME_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") } });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, permissions: ["clipboard-read", "clipboard-write"] });
const A = await ctx.newPage();
const B = await ctx.newPage();
for (const [p, w] of [[A, "A"], [B, "B"]]) {
  p.on("pageerror", (e) => errors.push(`[${w}] pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(`[${w}] console: ${m.text()}`));
}
const offline = (p, v) => p.evaluate((x) => window.__fragolinaMock.setOffline(x), v);

try {
  // ---------- 1. Onboarding e collegamento ----------
  await Promise.all([A.goto(base, { waitUntil: "networkidle" }), B.goto(base, { waitUntil: "networkidle" })]);
  await settle(A, 2600);
  await settle(B, 300);
  await shot(A, "A", "onboarding-benvenuto");
  await btn(A, "Avanti").click();
  await btn(B, "Avanti").click();
  await settle(A, 900);
  await shot(A, "A", "collegati-scelta");
  await shot(B, "B", "collegati-scelta");

  // B: nome + prova con codice sbagliato
  await B.getByLabel("Il tuo nome").fill("Nikole");
  await btn(B, "Ho un codice").click();
  await settle(B, 600);
  await shot(B, "B", "ho-codice-vuoto");
  await B.getByLabel("Codice di coppia").fill("AAAAAA");
  await settle(B, 300);
  await shot(B, "B", "codice-digitato");
  await btn(B, "Entra").click();
  check("B: codice sbagliato → messaggio d'errore", await seen(B, /Questo codice non esiste/));
  await B.waitForTimeout(250);
  await shot(B, "B", "codice-sbagliato");

  // A: crea il posto
  await btn(A, "Crea il nostro posto").click();
  check("A: compare il codice", await seen(A, /Aspettiamo l'altra persona/));
  await settle(A, 800);
  await shot(A, "A", "codice-attesa");
  const label = (await A.getByLabel(/Il vostro codice:/).first().getAttribute("aria-label")) ?? "";
  const code = label.replace(/^.*:\s*/, "").replace(/\s+/g, "");
  check("A: codice di 6 caratteri validi", /^[A-HJKMNP-Z2-9]{6}$/.test(code), code);

  // B: incolla/scrive il codice giusto
  await B.getByLabel("Codice di coppia").fill(code.slice(0, 3) + " " + code.slice(3).toLowerCase()); // incollato con spazio e minuscole
  await settle(B, 300);
  await shot(B, "B", "codice-giusto");
  await btn(B, "Entra").click();
  check("B: collegata (Eccovi.)", await seen(B, /Eccovi\./));
  await settle(B, 900);
  await shot(B, "B", "collegati-festa");
  check("A: si accorge da sola che B è entrata", await seen(A, /Eccovi\./, 20000));
  await settle(A, 900);
  await shot(A, "A", "collegati-festa");

  // fine onboarding
  for (const p of [A, B]) {
    await btn(p, "Avanti").click();
    await settle(p, 800);
  }
  await shot(A, "A", "onboarding-fatto");
  for (const p of [A, B]) {
    await btn(p, "Entra").click();
    await settle(p, 1400);
  }
  await shot(A, "A", "home-vuota");
  await shot(B, "B", "home-vuota");

  // ---------- 2. Penso a te ----------
  await btn(A, /Invia Penso a te/).click();
  await settle(A, 450);
  await shot(A, "A", "ping-inviato");
  check("B: riceve l'avviso in tempo reale", await seen(B, /sta pensando a te/, 12000));
  await shot(B, "B", "ping-ricevuto-avviso");
  await settle(B, 800);
  check("B: contatore dei pensieri ricevuti = 1", await seen(B, /ti ha pensato 1 volta/));
  check("A: contatore 'oggi' = 1", await seen(A, /^1 oggi$/));
  await shot(B, "B", "ping-ricevuto-home");

  // ---------- 3. Umore ----------
  await btn(B, /Il tuo umore/).click();
  await settle(B, 800);
  await shot(B, "B", "umore-sheet");
  await btn(B, "Voglia di coccole").click();
  await settle(B, 600);
  check("A: vede l'umore di B in tempo reale", await seen(A, /Voglia di coccole/, 12000));
  await settle(A, 900);
  await shot(A, "A", "umore-di-lei");
  await shot(B, "B", "umore-mio");

  // ---------- 4. Offline e ritorno ----------
  await offline(A, true);
  await settle(A, 300);
  await btn(A, /Invia Penso a te/).click();
  await settle(A, 300);
  await btn(A, /Invia Penso a te/).click();
  await settle(A, 700);
  check("A offline: badge 'Senza rete · 2 in attesa'", await seen(A, /Senza rete · 2 in attesa/, 8000));
  await shot(A, "A", "offline-in-coda");
  await settle(B, 600);
  check("B: durante l'offline di A non arriva nulla (ancora 1 pensiero)", await seen(B, /ti ha pensato 1 volta/, 3000));
  await offline(A, false);
  check("A: tornata la rete, la coda si svuota e B vede 3 pensieri", await seen(B, /ti ha pensato 3 volte/, 45000));
  await settle(A, 800);
  check("A: il badge sparisce", (await A.getByText(/Senza rete/).count()) === 0);
  await shot(A, "A", "offline-ripreso");
  await shot(B, "B", "tre-pensieri");

  // ---------- 5. Data condivisa ----------
  await btn(A, /Da quando\?/).click();
  await settle(A, 800);
  await shot(A, "A", "data-sheet");
  await btn(A, "Salva").click();
  await settle(A, 800);
  check("B: vede 'Si parte oggi' dalla data scelta da A", await seen(B, /Si parte oggi/, 12000));
  await shot(B, "B", "giorni-insieme-zero");
  await btn(B, /Cambia la data/).click();
  await settle(B, 700);
  await btn(B, "Anno −").click();
  await btn(B, "Salva").click();
  await settle(B, 900);
  check("A: vede la data cambiata da B (≥ 365 giorni)", await seen(A, /^36[56]$/, 12000));
  await shot(A, "A", "giorni-insieme-365");

  // ---------- 6. Domanda del giorno ----------
  await A.mouse.wheel(0, 700);
  await B.mouse.wheel(0, 700);
  await settle(A, 700);
  await shot(A, "A", "domanda-da-rispondere");
  await B.getByTestId("answer-b").click();
  await settle(B, 900);
  await shot(B, "B", "domanda-risposto-attesa");
  await settle(A, 1500);
  check("A: NON vede la risposta di B prima di rispondere", (await A.getByText(/ha risposto/).count()) === 0);
  await A.getByTestId("answer-a").click();
  check("A: dopo aver risposto compare la carta da scoprire", await seen(A, /Tocca per scoprire/, 10000));
  await settle(A, 900);
  await shot(A, "A", "domanda-carta-da-girare");
  await btn(A, /Scopri la risposta di/).click();
  await settle(A, 1100);
  await shot(A, "A", "domanda-carta-girata");
  check("A: la risposta di B è rivelata", await seen(A, /ha scelto/, 6000));
  check("B: riceve la carta di A in tempo reale", await seen(B, /Tocca per scoprire/, 12000));
  await settle(B, 700);
  await shot(B, "B", "domanda-carta-da-girare");

  // ---------- 7. Noi ----------
  for (const [p, w] of [[A, "A"], [B, "B"]]) {
    await p.getByRole("tab", { name: "Noi" }).click();
    await settle(p, 1100);
    await shot(p, w, "noi");
  }
  await btn(A, "Esci dal posto").click();
  await settle(A, 800);
  await shot(A, "A", "esci-conferma");
  await btn(A, "Resto").click();
  await settle(A, 700);
  check("A: 'Resto' chiude la conferma senza uscire", (await A.getByText(/Eccovi\.|Collegati con/).count()) > 0);
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e).split("\n")[0]);
  for (const [p, w] of [[A, "A"], [B, "B"]]) await p.screenshot({ path: path.join(outDir, `99-${w}-errore.png`) }).catch(() => {});
}

check("nessun errore in console / pageerror", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const w = Math.max(...rows.map((r) => r[1].length));
console.log(`\nSCHEDE: ${outDir}\nESITO  PROVA`);
for (const [s, nm, d] of rows) console.log(`${s}   ${nm.padEnd(w)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
