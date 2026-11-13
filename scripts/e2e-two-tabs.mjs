// Prova a DUE SCHEDE nel browser: ogni scheda è un telefono (identità per scheda), il finto server è condiviso.
// Uso: avvia `npm run web` (porta 8081), poi  ROUND=1 npm run e2e   → screenshot in docs/shots/session5/r<ROUND>/
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
const outDir = path.join(root, "docs", "shots", "session5", `r${round}${W === 390 ? "" : "-" + W}`);
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const home = os.homedir();
  const c = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const pw = path.join(home, ".cache", "ms-playwright");
  if (fs.existsSync(pw))
    for (const d of fs.readdirSync(pw).filter((n) => n.startsWith("chromium-")))
      c.push(path.join(pw, d, "chrome-linux64", "chrome"));
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
  await page.screenshot({
    path: path.join(outDir, `${String(n).padStart(2, "0")}-${who}-${name}.png`),
  });
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

const browser = await chromium.launch({
  executablePath: findBrowser(),
  args: ["--no-sandbox"],
  env: {
    ...process.env,
    LD_LIBRARY_PATH: [process.env.CHROME_LIBS, process.env.LD_LIBRARY_PATH]
      .filter(Boolean)
      .join(":"),
  },
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  permissions: ["clipboard-read", "clipboard-write", "geolocation"],
  geolocation: { latitude: 41.9028, longitude: 12.4964 }, // Roma
});
const A = await ctx.newPage();
const B = await ctx.newPage();
for (const [p, w] of [
  [A, "A"],
  [B, "B"],
]) {
  p.on("pageerror", (e) => errors.push(`[${w}] pageerror: ${e.message}`));
  p.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !/favicon|404/.test(m.text()) &&
      errors.push(`[${w}] console: ${m.text()}`),
  );
}
const offline = (p, v) => p.evaluate((x) => window.__fragolinaMock.setOffline(x), v);

try {
  // ---------- 1. Onboarding e collegamento ----------
  await Promise.all([
    A.goto(base, { waitUntil: "networkidle" }),
    B.goto(base, { waitUntil: "networkidle" }),
  ]);
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
  const label =
    (await A.getByLabel(/Il vostro codice:/)
      .first()
      .getAttribute("aria-label")) ?? "";
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
  check("B: contatore dei pensieri ricevuti = 1", await seen(B, /ricevuti 1/));
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
  check(
    "A offline: badge 'Senza rete · 2 in attesa'",
    await seen(A, /Senza rete · 2 in attesa/, 8000),
  );
  await shot(A, "A", "offline-in-coda");
  await settle(B, 600);
  check(
    "B: durante l'offline di A non arriva nulla (ancora 1 pensiero)",
    await seen(B, /ricevuti 1/, 3000),
  );
  await offline(A, false);
  check(
    "A: tornata la rete, la coda si svuota e B vede 3 pensieri",
    await seen(B, /ricevuti 3/, 45000),
  );
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
  check(
    "A: NON vede la risposta di B prima di rispondere",
    (await A.getByText(/ha risposto/).count()) === 0,
  );
  await A.getByTestId("answer-a").click();
  check(
    "A: dopo aver risposto compare la carta da scoprire",
    await seen(A, /Tocca per scoprire/, 10000),
  );
  await settle(A, 900);
  await shot(A, "A", "domanda-carta-da-girare");
  await btn(A, /Scopri la risposta di/).click();
  await settle(A, 1100);
  await shot(A, "A", "domanda-carta-girata");
  check("A: la risposta di B è rivelata", await seen(A, /ha scelto/, 6000));
  check("B: riceve la carta di A in tempo reale", await seen(B, /Tocca per scoprire/, 12000));
  await settle(B, 700);
  await shot(B, "B", "domanda-carta-da-girare");

  // ---------- 6b. Pet condiviso ----------
  for (const p of [A, B]) {
    await p.getByRole("tab", { name: "Pet" }).click();
    await settle(p, 1100);
  }
  check("Pet: l'uovo dorme (A e B)", (await seen(A, /Toccatelo piano/, 6000)) && (await seen(B, /Toccatelo piano/, 6000)));
  await shot(A, "A", "pet-uovo");
  await btn(A, /^L'uovo\./).click();
  await settle(A, 900);
  await shot(A, "A", "pet-uovo-toccato-da-me");
  check("Pet: A ha toccato, l'uovo lo segna subito", await seen(A, /Tu l'hai toccato/, 6000));
  check("Pet: B vede in tempo reale che A l'ha toccato", await seen(B, /l'ha toccato/, 12000));
  await shot(B, "B", "pet-uovo-toccato-da-lei");
  await btn(B, /^L'uovo\./).click();
  check("Pet: toccato da entrambi → si SCHIUDE su B", await seen(B, /Come la chiamate\?/, 12000));
  await settle(B, 900);
  await shot(B, "B", "pet-schiusa-nome");
  await B.getByLabel("Nome", { exact: true }).fill("Bacca");
  await btn(B, "Va bene così").click();
  await settle(B, 900);
  check("Pet: B ha dato il nome", await seen(B, /^Bacca$/, 6000));
  check("Pet: A vede il pet nato con il nome scelto da B", await seen(A, /^Bacca$/, 15000));
  await settle(A, 900);
  await shot(A, "A", "pet-nato");
  await shot(B, "B", "pet-nato");
  // A nutre: B vede il toast e la cura nel registro
  await btn(A, "Mangia").click();
  await settle(A, 700);
  await shot(A, "A", "pet-vassoio");
  await btn(A, /^Mora\./).click();
  await settle(A, 500);
  await shot(A, "A", "pet-mangia");
  check("Pet: B riceve 'ha dato una mora a Bacca' in tempo reale", await seen(B, /ha dato una mora a Bacca/, 12000));
  await shot(B, "B", "pet-toast-cibo");
  await settle(B, 900);
  check("Pet: il registro di B mostra la cura di A", await seen(B, /ha dato una mora/, 6000));
  check("Pet: il registro di A dice 'Hai dato una mora'", await seen(A, /Hai dato una mora/, 6000));
  // B trascina una pesca sul pet (drag col mouse): A vede il toast
  await btn(B, "Mangia").click();
  await settle(B, 700);
  const peach = await btn(B, /^Pesca\./).boundingBox();
  const petBox = await B.getByRole("button", { name: /Bacca, / }).first().boundingBox();
  if (peach && petBox) {
    await B.mouse.move(peach.x + peach.width / 2, peach.y + peach.height / 2);
    await B.mouse.down();
    await B.mouse.move(petBox.x + petBox.width / 2, petBox.y + petBox.height * 0.6, { steps: 14 });
    await shot(B, "B", "pet-trascina-frutto");
    await B.mouse.up();
  }
  check("Pet: il frutto TRASCINATO sul pet vale come cibo (A vede 'una pesca')", await seen(A, /ha dato una pesca a Bacca/, 12000));
  await settle(B, 700);
  await btn(B, "Mangia").click(); // richiude il vassoio
  // carezza col dito (trascinamento avanti e indietro)
  const stage = await B.getByRole("button", { name: /Bacca, / }).first().boundingBox();
  if (stage) {
    const cx = stage.x + stage.width / 2;
    const cy = stage.y + stage.height / 2;
    await B.mouse.move(cx - 80, cy);
    await B.mouse.down();
    for (let i = 0; i < 6; i++) {
      await B.mouse.move(cx + (i % 2 ? -90 : 90), cy + 8, { steps: 8 });
    }
    await shot(B, "B", "pet-carezza");
    await B.mouse.up();
  }
  await settle(B, 900);
  check("Pet: la carezza completa conta come coccola (registro di B)", await seen(B, /Hai fatto le coccole/, 6000));
  check("Pet: A vede le coccole di B", await seen(A, /ha fatto le coccole a Bacca/, 12000));
  await shot(A, "A", "pet-toast-coccole");
  // offline: la cura resta in coda e arriva al ritorno
  await offline(A, true);
  await settle(A, 400);
  await btn(A, "Gioca").click();
  await settle(A, 700);
  await shot(A, "A", "pet-gioco");
  await A.keyboard.press("Escape");
  await settle(A, 300);
  await offline(A, false);
  await settle(A, 300);
  await shot(A, "A", "pet-dopo-rete");
  // Nanna: luce spenta
  await btn(B, "Nanna").click();
  await settle(B, 900);
  check("Pet: B mette a nanna, A lo vede dormire", await seen(A, /Luce spenta/, 15000));
  await shot(A, "A", "pet-nanna");
  await shot(B, "B", "pet-nanna");


  // ---------- 6c. Biglietto sul blocco e distanza ----------
  const exact = (p, name) => p.getByRole("button", { name, exact: true }).first();
  for (const p of [A, B]) {
    await p.getByRole("tab", { name: "Disegna" }).click();
    await settle(p, 1200);
  }
  check("Biglietto: la scheda Disegna si chiama 'Manda sul blocco'", await seen(A, /Manda sul blocco/, 8000));
  await shot(A, "A", "disegna-vuota");
  // A manda una scritta
  await btn(A, "Scritta").click();
  await settle(A, 400);
  await A.getByLabel("Testo del biglietto").fill("Ti penso");
  await settle(A, 300);
  await shot(A, "A", "disegna-scritta");
  await exact(A, "Manda").click();
  check("Biglietto: A manda la scritta e vede 'Sul blocco adesso' (da te)", (await seen(A, /Sul blocco adesso/, 12000)) && (await seen(A, /^Da te$/, 4000)));
  await settle(A, 900);
  await shot(A, "A", "biglietto-mandato");
  check("Biglietto: B riceve l'avviso in tempo reale", await seen(B, /Leonardo ti ha lasciato un biglietto/, 12000));
  await shot(B, "B", "biglietto-ricevuto");
  check("Biglietto: B lo vede con 'Da Leonardo' e 'sparisce tra'", (await seen(B, /^Da Leonardo$/, 8000)) && (await seen(B, /sparisce tra/, 4000)));
  // B lo pulisce: sparisce anche su A
  await exact(B, "Pulisci").click();
  await settle(B, 800);
  check("Biglietto: B pulisce → sparisce su B subito", (await B.getByText(/Sul blocco adesso/).count()) === 0);
  await settle(A, 1500);
  check("Biglietto: …e sparisce su A (Pulisci vale per entrambi)", await (async () => { for (let i = 0; i < 20; i++) { if ((await A.getByText(/Sul blocco adesso/).count()) === 0) return true; await settle(A, 500); } return false; })());
  // B disegna col mouse e manda
  await exact(B, "Disegno").click();
  await settle(B, 1200);
  const hint = await B.getByText(/Foglio bianco/).first().boundingBox();
  if (hint) {
    await B.mouse.move(hint.x + 10, hint.y + 40);
    await B.mouse.down();
    await B.mouse.move(hint.x + 120, hint.y + 120, { steps: 12 });
    await B.mouse.move(hint.x + 220, hint.y + 40, { steps: 12 });
    await B.mouse.up();
    await settle(B, 500);
    await shot(B, "B", "disegno-in-corso");
  }
  check("Biglietto: B vede l'anteprima del widget mentre disegna", (await B.getByTestId("note-preview").getByText(/da te · adesso/).count()) > 0);
  await exact(B, "Manda").click();
  check("Biglietto: A riceve il DISEGNO di B con l'avviso", await seen(A, /Nikole ti ha lasciato un biglietto/, 12000));
  check("Biglietto: A lo vede 'Da Nikole'", await seen(A, /^Da Nikole$/, 8000));
  await settle(A, 800);
  await shot(A, "A", "disegno-ricevuto");
  // scadenza a 1 ora (orologio finto sulla scheda A)
  await A.clock.install();
  await A.clock.fastForward(61 * 60 * 1000);
  check("Biglietto: dopo 61 minuti sparisce da solo (orologio finto)", await (async () => { for (let i = 0; i < 30; i++) { if ((await A.getByText(/Sul blocco adesso/).count()) === 0) return true; await A.clock.fastForward(21000); await settle(A, 300); } return false; })());
  await shot(A, "A", "biglietto-scaduto");
  await A.clock.resume(); // il tempo torna a scorrere (i tempi d'attesa della rete finta usano i timer)
  // offline (su B: la scheda A ha l'orologio finto): il biglietto resta in coda e parte al ritorno della rete
  await offline(B, true);
  await exact(B, "Scritta").click();
  await B.getByLabel("Testo del biglietto").fill("Ti scrivo senza rete");
  await exact(B, "Manda").click();
  const queued = await seen(B, /^in coda$/, 8000);
  check("Biglietto offline: resta 'in coda' (card e badge)", queued);
  await shot(B, "B", "biglietto-offline");
  await offline(B, false);
  check("Biglietto offline: al ritorno della rete arriva ad A", await seen(A, /Nikole ti ha lasciato un biglietto/, 30000));

  // ---- distanza: Roma (A) e Milano (B), con consenso reciproco ----
  await A.getByRole("tab", { name: "Noi" }).click();
  await B.getByRole("tab", { name: "Noi" }).click();
  await settle(A, 1000);
  check("Distanza: la scheda Noi ha l'interruttore, spento di partenza", (await A.getByRole("switch", { name: "Condividi la distanza" }).count()) > 0);
  await shot(A, "A", "distanza-spenta");
  // sul telefono il permesso parte "non ancora deciso": simuliamo il "prompt" del browser fino alla prima richiesta
  await A.evaluate(() => {
    let asked = false;
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (d) =>
      d && d.name === "geolocation" ? { state: asked ? "granted" : "prompt", onchange: null, addEventListener() {}, removeEventListener() {} } : q(d);
    const g = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (ok, ko, o) => {
      asked = true;
      g(ok, ko, o);
    };
  });
  await settle(A, 300);
  await A.getByRole("switch", { name: "Condividi la distanza" }).click();
  check("Distanza: prima del permesso di sistema c'è la NOSTRA spiegazione", await seen(A, /Posso sapere dov'è il telefono/, 6000));
  await shot(A, "A", "distanza-permesso");
  await btn(A, "Va bene").click();
  await settle(A, 2500);
  await ctx.setGeolocation({ latitude: 45.4642, longitude: 9.19 }); // Milano
  await B.getByRole("switch", { name: "Condividi la distanza" }).click(); // permesso già dato: parte senza spiegazione
  await settle(B, 2500);
  const km = /a 4\d\d km/;
  check("Distanza: con il consenso di entrambi B vede 'a 4xx km' (Roma-Milano)", await seen(B, km, 20000));
  check("Distanza: …e anche A", await seen(A, km, 25000));
  await shot(A, "A", "distanza-477");
  await shot(B, "B", "distanza-477");
  // B spegne: A vede 'Distanza nascosta'
  await B.getByRole("switch", { name: "Condividi la distanza" }).click();
  check("Distanza: B spegne → A vede 'Distanza nascosta'", await seen(A, /Distanza nascosta/, 25000));
  await shot(A, "A", "distanza-nascosta");

  // ---------- 7. Noi ----------
  for (const [p, w] of [
    [A, "A"],
    [B, "B"],
  ]) {
    await p.getByRole("tab", { name: "Noi" }).click();
    await settle(p, 1100);
    await shot(p, w, "noi");
  }
  await btn(A, "Esci dal posto").click();
  await settle(A, 800);
  await shot(A, "A", "esci-conferma");
  await btn(A, "Resto").click();
  await settle(A, 700);
  check(
    "A: 'Resto' chiude la conferma senza uscire",
    (await A.getByText(/Eccovi\.|Collegati con/).count()) > 0,
  );

  // ---------- 8. Stati d'errore ----------
  // C: prova a entrare in una coppia già piena
  const C = await ctx.newPage();
  await C.goto(base, { waitUntil: "networkidle" });
  await settle(C, 2200);
  await btn(C, "Avanti").click();
  await btn(C, "Ho un codice").click();
  await C.getByLabel("Codice di coppia").fill(code);
  await btn(C, "Entra").click();
  check("C: coppia piena → messaggio dedicato", await seen(C, /già al completo/));
  await settle(C, 400);
  await shot(C, "C", "coppia-piena");
  // D: crea il posto senza rete
  const D = await ctx.newPage();
  await D.goto(base, { waitUntil: "networkidle" });
  await settle(D, 2200);
  await btn(D, "Avanti").click();
  await offline(D, true);
  await btn(D, "Crea il nostro posto").click();
  check("D: senza rete → messaggio 'Niente rete'", await seen(D, /Niente rete/));
  await settle(D, 400);
  await shot(D, "D", "creazione-senza-rete");
  // E: codice scaduto
  const E = await ctx.newPage();
  await E.goto(base, { waitUntil: "networkidle" });
  await settle(E, 2200);
  await btn(E, "Avanti").click();
  await btn(E, "Crea il nostro posto").click();
  await seen(E, /Aspettiamo l'altra persona/);
  await E.evaluate(() => {
    const k = "fragolina.mock.server.v1";
    const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.couples))
      if (c.joinCode && !s.members.filter((m) => m.coupleId === c.id)[1])
        c.expiresAt = Date.now() - 1000;
    localStorage.setItem(k, JSON.stringify(s));
  });
  check("E: codice scaduto → 'Nuovo codice'", await seen(E, /Codice scaduto/, 30000));
  await settle(E, 500);
  await shot(E, "E", "codice-scaduto");
  await btn(E, "Nuovo codice").click();
  check("E: il codice nuovo sostituisce quello scaduto", await seen(E, /Vale ancora/, 10000));
  await settle(E, 500);
  await shot(E, "E", "codice-rinnovato");
  // A: sessione sostituita
  await A.evaluate(() => sessionStorage.setItem("fragolina.mock.uid", crypto.randomUUID()));
  await A.reload({ waitUntil: "networkidle" });
  await settle(A, 2500);
  await A.getByRole("tab", { name: "Noi" }).click();
  check(
    "A: sessione sostituita → avviso nella scheda Noi",
    await seen(A, /non è più nel posto/, 15000),
  );
  await settle(A, 600);
  await shot(A, "A", "sessione-persa");
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e).split("\n")[0]);
  for (const [p, w] of [
    [A, "A"],
    [B, "B"],
  ])
    await p.screenshot({ path: path.join(outDir, `99-${w}-errore.png`) }).catch(() => {});
}

check("nessun errore in console / pageerror", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const w = Math.max(...rows.map((r) => r[1].length));
console.log(`\nSCHEDE: ${outDir}\nESITO  PROVA`);
for (const [s, nm, d] of rows) console.log(`${s}   ${nm.padEnd(w)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
