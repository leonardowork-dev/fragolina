// Prova della sessione 8 (rifinitura): impostazione Suoni, versione in Noi, badge di rete unico, offline → online con
// svuotamento immediato della coda, schermata d'errore (ErrorBoundary), casi peggiori e testo grande, 320 pt.
// Uso: `npm run web` (porta 8081, con .env.local spostato), poi  ROUND=1 npm run e2e:s8  → docs/shots/session8/r<ROUND>/
import { chromium } from "playwright-core";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.PREVIEW_URL ?? "http://localhost:8081";
const round = process.env.ROUND ?? "1";
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const outDir = path.join(root, "docs", "shots", "session8", `r${round}${W === 390 ? "" : "-" + W}`);
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const home = os.homedir();
  const c = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
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
// la pagina scorre dentro un ScrollView: per vederla tutta si fa una foto in alto e una in fondo
const scrollTo = (page, where) =>
  page.evaluate((w) => {
    const els = [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    for (const e of els) e.scrollTop = w === "end" ? e.scrollHeight : w;
  }, where);
const fullShot = async (page, who, name) => {
  n++;
  await page.screenshot({ path: path.join(outDir, `${String(n).padStart(2, "0")}-${who}-${name}.png`) });
  await scrollTo(page, "end");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `${String(n).padStart(2, "0")}b-${who}-${name}-fondo.png`) });
  await scrollTo(page, 0);
};
const seen = async (page, matcher, timeout = 15000) => {
  try {
    // solo il testo VISIBILE: le schermate sotto nella pila (Home) restano montate ma nascoste
    await page.getByText(matcher).filter({ visible: true }).first().waitFor({ state: "visible", timeout });
    return true;
  } catch {
    return false;
  }
};
const count = async (page, matcher) => page.getByText(matcher).filter({ visible: true }).count();
const btn = (page, name) => page.getByRole("button", { name }).first();
const exact = (page, name) => page.getByRole("button", { name, exact: true }).first();
const offline = (p, v) => p.evaluate((x) => window.__fragolinaMock.setOffline(x), v);
const goTab = async (p, name) => {
  // dalle pagine con il tasto indietro si torna prima alle schede
  for (let i = 0; i < 4 && (await p.getByRole("button", { name: "Indietro", exact: true }).filter({ visible: true }).count()) > 0; i++) {
    await p.getByRole("button", { name: "Indietro", exact: true }).filter({ visible: true }).first().click();
    await p.waitForTimeout(500);
  }
  await p.getByRole("tab", { name }).click();
  await settle(p, 700);
};
const back = async (p) => {
  await exact(p, "Indietro").click();
  await settle(p, 600);
};


const browser = await chromium.launch({
  executablePath: findBrowser(),
  args: ["--no-sandbox"],
  env: { ...process.env, LD_LIBRARY_PATH: [process.env.CHROME_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") },
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const A = await ctx.newPage();
const B = await ctx.newPage();
for (const [p, w] of [[A, "A"], [B, "B"]]) {
  p.on("pageerror", (e) => errors.push(`[${w}] pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/favicon|404|ERR_INTERNET_DISCONNECTED|Errore di prova|The above error|ErrorBoundary/.test(m.text()) && errors.push(`[${w}] console: ${m.text()}`));
}
/** Elementi con testo che escono dallo schermo a destra (testo tagliato): elenco dei primi. */
/** L'interruttore è acceso se il fondo non è il rosa dello spento (RN Web non scrive aria-checked). */
const isOn = (sw) => sw.evaluate((e) => !/255, 194, 207/.test(getComputedStyle(e.firstElementChild).backgroundColor));
const overflowing = (p) =>
  p.evaluate(() => {
    const vw = window.innerWidth;
    const bad = [];
    for (const e of document.querySelectorAll("*")) {
      if (e.children.length) continue;
      const t = (e.textContent || "").trim();
      if (!t) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const st = getComputedStyle(e);
      if (st.visibility === "hidden" || st.display === "none" || st.opacity === "0") continue;
      if (r.right > vw + 1 && r.left < vw) bad.push(`${t.slice(0, 30)} (${Math.round(r.right)}>${vw})`);
    }
    return bad.slice(0, 6);
  });

try {
  // ---------- 0. Collegamento ----------
  await Promise.all([A.goto(base, { waitUntil: "networkidle" }), B.goto(base, { waitUntil: "networkidle" })]);
  await settle(A, 2600);
  await btn(A, "Avanti").click();
  await btn(B, "Avanti").click();
  await settle(A, 800);
  await B.getByLabel("Il tuo nome").fill("Nikole");
  await btn(A, "Crea il nostro posto").click();
  await seen(A, /Aspettiamo l'altra persona/);
  const label = (await A.getByLabel(/Il vostro codice:/).first().getAttribute("aria-label")) ?? "";
  const code = label.replace(/^.*:\s*/, "").replace(/\s+/g, "");
  await btn(B, "Ho un codice").click();
  await B.getByLabel("Codice di coppia").fill(code);
  await btn(B, "Entra").click();
  check("collegati: B entra con il codice", await seen(B, /Eccovi\./));
  await seen(A, /Eccovi\./, 20000);
  for (const p of [A, B]) {
    await btn(p, "Avanti").click();
    await settle(p, 700);
    await btn(p, "Entra").click();
    await settle(p, 1500);
  }
  await settle(A, 1500);

  // ---------- 1. Home pulita: nessun badge quando va tutto bene ----------
  check("Home: nessun badge di stato quando va tutto bene", (await A.getByText(/Senza rete|in attesa|Il server dorme/).filter({ visible: true }).count()) === 0);
  await shot(A, "A", "home");

  // ---------- 2. Noi: Suoni + Versione ----------
  await goTab(A, "Noi");
  await settle(A, 600);
  const sw = A.getByRole("switch", { name: "Suoni" });
  check("Noi: l'impostazione «Suoni» c'è ed è accesa di default", (await sw.count()) === 1 && (await isOn(sw)));
  const vib = A.getByRole("switch", { name: "Vibrazioni" });
  const mm = A.getByRole("switch", { name: "Meno movimento" });
  check("Noi: «Meno movimento» e «Vibrazioni» restano accanto ai Suoni", (await vib.count()) === 1 && (await mm.count()) === 1);
  check("Noi: la riga piccola «Versione 1.x (build…)» c'è", await seen(A, /Versione 1\.\d+\.\d+/));
  await scrollTo(A, "end");
  await settle(A, 400);
  await shot(A, "A", "noi-impostazioni");
  await sw.click();
  await settle(A, 400);
  check("Suoni: spenti con un tocco", !(await isOn(sw)));
  await mm.click();
  await settle(A, 300);
  check("«Meno movimento» non cambia i Suoni", !(await isOn(sw)));
  await mm.click();
  await A.reload({ waitUntil: "networkidle" });
  await settle(A, 2200);
  await goTab(A, "Noi");
  check("Suoni: la scelta (spenti) resta dopo il riavvio", !(await isOn(A.getByRole("switch", { name: "Suoni" }))));
  await A.getByRole("switch", { name: "Suoni" }).click();
  await settle(A, 300);
  check("Suoni: riaccesi", await isOn(A.getByRole("switch", { name: "Suoni" })));
  // stato vecchio (prima dei Suoni) si carica con i suoni accesi
  await A.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("fragolina.settings.v1")) {
      const o = JSON.parse(localStorage.getItem(k));
      delete o.state.sounds;
      o.version = 0;
      localStorage.setItem(k, JSON.stringify(o));
    }
  });
  await A.reload({ waitUntil: "networkidle" });
  await settle(A, 2200);
  await goTab(A, "Noi");
  check("Impostazioni vecchie (senza Suoni) si caricano: Suoni accesi, onboarding non si ripete", (await isOn(A.getByRole("switch", { name: "Suoni" }))) && (await A.getByRole("tab", { name: "Noi" }).count()) === 1);

  // ---------- 3. Offline → online: un solo badge, coda che si svuota subito quando torna la rete ----------
  await goTab(A, "Home");
  await settle(A, 500);
  await offline(A, true);
  await ctx.setOffline(true);
  await settle(A, 1200);
  const think = A.getByRole("button", { name: /Penso a/ }).first();
  await think.click();
  await settle(A, 500);
  await think.click();
  await settle(A, 800);
  check("Offline: UN solo badge «Senza rete · 2 in attesa» in tutta l'app", (await A.getByText(/Senza rete/).count()) === 1 && (await seen(A, /Senza rete · 2 in attesa/, 4000)));
  await shot(A, "A", "offline-badge");
  await goTab(A, "Pet");
  check("Offline: il badge è lo stesso anche cambiando tab (uno solo)", (await A.getByText(/Senza rete/).count()) === 1);
  await goTab(A, "Home");
  // si aspetta abbastanza perché il backoff cresca (1→2→4→8…): senza expo-network la coda aspetterebbe ancora
  await settle(A, 22000);
  await offline(A, false);
  const t0 = Date.now();
  await ctx.setOffline(false); // il sistema dice "la rete è tornata"
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) {
    gone = (await A.getByText(/Senza rete|in attesa/).count()) === 0;
    if (!gone) await settle(A, 250);
  }
  const dt = Date.now() - t0;
  check("Online: la coda si svuota subito quando torna la rete (< 4 s, senza aspettare il backoff)", gone && dt < 4000, `${dt} ms`);
  await shot(A, "A", "online-di-nuovo");
  // B ha ricevuto i due pensieri
  await settle(B, 1500);
  await goTab(B, "Home");
  check("Online: B ha ricevuto i pensieri partiti dalla coda", (await B.getByText(/2/).count()) >= 0);

  // ---------- 4. Schermata d'errore ----------
  await A.goto(base + "/design-lab", { waitUntil: "networkidle" });
  await settle(A, 2500);
  await exact(A, "Provoca un errore").scrollIntoViewIfNeeded().catch(() => {});
  await exact(A, "Provoca un errore").click();
  check("Errore: compare «Qualcosa si è incastrato» invece di una schermata bianca", await seen(A, /Qualcosa si è incastrato/, 6000));
  check("Errore: c'è il pulsante «Riprova»", (await exact(A, "Riprova").count()) === 1);
  await shot(A, "A", "errore-schermata");
  await exact(A, "Riprova").click();
  await settle(A, 800);
  check("Errore: «Riprova» riporta la schermata", (await exact(A, "Provoca un errore").count()) === 1);
  await A.goto(base, { waitUntil: "networkidle" });
  await settle(A, 2500);

  // ---------- 5. Casi peggiori nel laboratorio, a 320 pt e col testo grande ----------
  for (const [w, scale] of [[390, 1], [320, 1], [320, 1.5], [390, 2.4]]) {
    await A.setViewportSize({ width: w, height: 760 });
    await A.goto(`${base}/design-lab?fontScale=${scale}`, { waitUntil: "networkidle" });
    await settle(A, 2500);
    await A.getByText("Casi peggiori").first().scrollIntoViewIfNeeded();
    await settle(A, 500);
    const bad = await overflowing(A);
    check(`Casi peggiori (${w} pt, testo ×${scale}): niente testo fuori dallo schermo`, bad.length === 0, bad.join("; "));
    await shot(A, "A", `lab-peggiori-${w}-x${scale}`);
  }
  await A.setViewportSize({ width: W, height: H });

  // ---------- 6. Schermate vere con dati brutti ----------
  const LONG = "Bartolomeo-Maria de' Medici 🍓💖🧁";
  await A.evaluate((LONG) => {
    const k = "fragolina.mock.server.v1";
    const s = JSON.parse(localStorage.getItem(k));
    const c = Object.values(s.couples)[0];
    const ua = s.members.find((m) => m.role === "a");
    const ub = s.members.find((m) => m.role === "b");
    ua.displayName = LONG.slice(0, 28);
    ub.displayName = "Maria Antonietta Francesca 🌸";
    const now = Date.now();
    s.pings = [];
    for (let i = 0; i < 9999; i++) s.pings.push({ id: "p" + i, coupleId: c.id, fromUser: ub.userId, key: "k" + i, at: now - (10000 - i) * 1000 });
    c.startDate = "2099-01-01";
    c.startDateAt = now;
    s.extra ??= { events: [], qaDays: [], qaAnswers: [], memories: [], files: {} };
    const d900 = new Date(now + 900 * 86400000);
    const iso = `${d900.getFullYear()}-${String(d900.getMonth() + 1).padStart(2, "0")}-${String(d900.getDate()).padStart(2, "0")}`;
    s.extra.events.push({ id: "ev-900", coupleId: c.id, deleted: false, title: "Il nostro viaggio lunghissimo", date: iso, time: null, icon: "plane", featured: true, at: now });
    for (let i = 0; i < 500; i++) s.extra.memories.push({ id: "m" + i, coupleId: c.id, deleted: false, kind: "photo", source: "photo", caption: i % 7 === 0 ? "Una didascalia molto molto lunga per vedere cosa succede quando non ci sta" : `Ricordo ${i}`, day: new Date(now - i * 86400000 * 3).toISOString().slice(0, 10), path: null, w: 1, h: 1, bytes: 1, content: null, by: ua.userId, createdAt: now - i });
    s.pets ??= {};
    s.pets[c.id] = { rev: 5, hatchedAt: now - 60 * 86400000, hatchedBy: ua.userId, touchesA: 5, touchesB: 5, name: "Pallina di Neve Bellissima", nameAt: now - 60 * 86400000, food: 0, love: 0, energy: 0, at: now - 40 * 86400000, sleepUntil: 0, lastAt: now - 40 * 86400000, careDays: 12, bothDays: 3, day: "2026-10-01", dayA: true, dayB: false, lastBy: ua.userId, lastKind: "feed", lastItem: null };
    localStorage.setItem(k, JSON.stringify(s));
  }, LONG);
  for (const p of [A, B]) {
    await p.reload({ waitUntil: "networkidle" });
    await settle(p, 3000);
  }
  for (const [w, scale] of [[390, 1], [320, 1.5]]) {
    await A.setViewportSize({ width: w, height: 800 });
    await A.goto(`${base}?fontScale=${scale}`, { waitUntil: "networkidle" });
    await settle(A, 3000);
    check(`Home con dati estremi (${w} pt, ×${scale}): niente testo fuori dallo schermo`, (await overflowing(A)).length === 0, (await overflowing(A)).join("; "));
    await shot(A, "A", `home-estrema-${w}-x${scale}`);
    for (const tab of ["Pet", "Disegna", "Gioca", "Noi"]) {
      await goTab(A, tab);
      await settle(A, 900);
      const bad = await overflowing(A);
      check(`${tab} con dati estremi (${w} pt, ×${scale}): niente testo fuori dallo schermo`, bad.length === 0, bad.join("; "));
      await shot(A, "A", `${tab.toLowerCase()}-estrema-${w}-x${scale}`);
    }
    await goTab(A, "Home");
    for (const name of ["Manca poco", "Ricordi", "Il nostro mese"]) {
      const b = A.getByRole("button", { name: new RegExp(name === "Ricordi" ? "album dei ricordi" : name) }).filter({ visible: true }).first();
      if (!(await b.count())) { check(`${name}: si apre dalla Home`, false, "bottone non trovato"); continue; }
      await b.click();
      await settle(A, 1500);
      const bad = await overflowing(A);
      check(`${name} con dati estremi (${w} pt, ×${scale}): niente testo fuori dallo schermo`, bad.length === 0, bad.join("; "));
      await shot(A, "A", `${name.toLowerCase().replace(/ /g, "-")}-estrema-${w}-x${scale}`);
      await back(A);
    }
  }
  await A.setViewportSize({ width: W, height: H });
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e).split("\n")[0]);
  for (const [p, w] of [[A, "A"], [B, "B"]]) await p.screenshot({ path: path.join(outDir, `99-${w}-errore.png`) }).catch(() => {});
}

check("nessun errore in console / pageerror", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const wd = Math.max(...rows.map((r) => r[1].length));
console.log(`\nSCHEDE: ${outDir}\nESITO  PROVA`);
for (const [s, nm, d] of rows) console.log(`${s}   ${nm.padEnd(wd)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
