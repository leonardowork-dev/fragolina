// Prova a DUE SCHEDE della sessione 7: conto alla rovescia, domanda del giorno vera (segreta, poi rivelata, domanda di
// domani, archivio), Ricordi (foto, cancellazione, offline, "un anno fa"), Il nostro mese. Ogni scheda è un telefono.
// Uso: `npm run web` (porta 8081, con .env.local spostato), poi  ROUND=1 npm run e2e:extra  → docs/shots/session7/r<ROUND>/
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
const outDir = path.join(root, "docs", "shots", "session7", `r${round}${W === 390 ? "" : "-" + W}`);
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
const fullShot = async (page, who, name) => {
  n++;
  await page.screenshot({ path: path.join(outDir, `${String(n).padStart(2, "0")}-${who}-${name}.png`), fullPage: true });
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

// un'immagine di prova (PNG 1200×800, tre colori): il selettore del browser la darà alla scheda
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#FFC2CF"/><circle cx="420" cy="380" r="260" fill="#FF2D55"/><rect x="700" y="160" width="360" height="460" rx="40" fill="#8FD3FF"/><circle cx="880" cy="640" r="90" fill="#FFD84D"/></svg>`;
const png = new Resvg(svg).render().asPng();
const photoFile = path.join(os.tmpdir(), "fragolina-prova.png");
fs.writeFileSync(photoFile, png);

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
  p.on("console", (m) => /foto non letta/.test(m.text()) && console.log(`[${w}] ${m.text()}`));
  p.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(`[${w}] console: ${m.text()}`));
}

const pickPhoto = async (p, caption) => {
  const [chooser] = await Promise.all([p.waitForEvent("filechooser"), exact(p, "Aggiungi foto").click()]);
  await chooser.setFiles(photoFile);
  await seen(p, /Nuova foto/, 20000);
  await settle(p, 600);
  if (caption) await p.getByLabel("Didascalia (facoltativa)").fill(caption);
};

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

  // ---------- 1. Home: cose nuove, senza rumore ----------
  check("Home: la domanda del giorno c'è (versione vera, dal mazzo)", (await A.getByTestId("qa-card-text").count()) === 1 && (await A.getByTestId("qa-card-text").innerText()).endsWith("?"));
  const qA = await A.getByTestId("qa-card-text").innerText();
  const qB = await B.getByTestId("qa-card-text").innerText();
  check("Domanda: A e B vedono la stessa domanda lo stesso giorno", qA === qB && qA.length > 10, `${qA} | ${qB}`);
  check("Home: senza eventi 'Manca poco' non occupa posto (niente rumore)", (await A.getByTestId("home-countdown-line").count()) === 0);
  check("Home: senza ricordi di un anno fa non compare 'Un anno fa oggi'", (await A.getByTestId("year-ago").count()) === 0);
  await fullShot(A, "A", "home-iniziale");

  // ---------- 2. CONTO ALLA ROVESCIA ----------
  await goTab(A, "Noi");
  check("Noi: i collegamenti 'Insieme' ci sono (Manca poco, domanda, ricordi, mese)", (await A.getByRole("button", { name: "Manca poco" }).count()) > 0 && (await A.getByRole("button", { name: "Il nostro mese" }).count()) > 0);
  await shot(A, "A", "noi-insieme");
  await exact(A, "Manca poco").click();
  await seen(A, /Niente da aspettare, per ora\./);
  check("Manca poco: stato vuoto con invito", await seen(A, /Metti una data/));
  await shot(A, "A", "manca-poco-vuoto");
  await exact(A, "Nuovo evento").click();
  await seen(A, /Come lo chiami\?/);
  await A.getByLabel("Come lo chiami?").fill("Ci vediamo");
  await A.getByLabel("Treno").click();
  await shot(A, "A", "evento-nuovo");
  await exact(A, "Salva").click();
  await A.getByTestId("cd-big").first().waitFor({ timeout: 10000 }).catch(() => {});
  check("Manca poco: A crea 'Ci vediamo' (di default fra 7 giorni) e lo vede subito", (await A.getByRole("button", { name: /Ci vediamo, tra 7 giorni/ }).count()) > 0 && (await A.getByTestId("cd-big").count()) > 0);
  check("Manca poco: il numero grande è 7 giorni", (await A.getByTestId("cd-big").first().innerText()).trim() === "7");
  await settle(A, 800);
  await shot(A, "A", "manca-poco-evento");
  await back(A);
  await goTab(A, "Home");
  check("Home (A): 'tra 7 giorni: Ci vediamo'", await seen(A, /tra 7 giorni: Ci vediamo/));
  await settle(B, 1500);
  check("Home (B): lo stesso evento arriva in tempo reale", await seen(B, /tra 7 giorni: Ci vediamo/, 15000));
  await fullShot(B, "B", "home-con-evento");
  // B lo modifica (last-write-wins): cambia titolo; A lo vede
  await B.getByTestId("home-countdown-line").click();
  await seen(B, /Manca poco/);
  await B.getByTestId("cd-big").first().waitFor({ timeout: 8000 });
  await B.getByRole("button", { name: /Ci vediamo/ }).first().click();
  await seen(B, /Modifica evento/);
  await B.getByLabel("Come lo chiami?").fill("Ci vediamo a Roma");
  await exact(B, "Salva").click();
  await settle(B, 900);
  check("Manca poco: B modifica il titolo, A lo vede (last-write-wins)", await seen(A, /tra 7 giorni: Ci vediamo a Roma/, 15000));
  // offline: A crea un secondo evento senza rete; arriva al ritorno
  await exact(B, "Indietro").click();
  await goTab(A, "Noi");
  await exact(A, "Manca poco").click();
  await seen(A, /Ci vediamo a Roma/);
  await offline(A, true);
  await settle(A, 400);
  await exact(A, "Nuovo evento").click();
  await seen(A, /Come lo chiami\?/);
  await A.getByLabel("Come lo chiami?").fill("Concerto");
  await A.getByLabel("Biglietto", { exact: true }).click();
  await exact(A, "Salva").click();
  await settle(A, 800);
  check("Offline: l'evento 'Concerto' si vede subito su A, con 'In coda'", (await seen(A, /Concerto/)) && (await seen(A, /In coda/, 4000)));
  await shot(A, "A", "manca-poco-offline");
  await offline(A, false);
  await goTab(B, "Noi").catch(() => {});
  await B.getByRole("tab", { name: "Home" }).click().catch(() => {});
  await settle(B, 500);
  await exact(B, "Noi").click().catch(() => {});
  const bHasConcerto = await B.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const st = JSON.parse(localStorage.getItem("fragolina.mock.server.v1") || "{}");
      if ((st.extra?.events ?? []).some((e) => e.title === "Concerto")) return true;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  });
  check("Ritorno: l'evento fatto offline arriva sul server", bHasConcerto);
  // in evidenza: A mette in evidenza "Concerto" → in Home vince lui, anche se è più lontano
  await A.getByRole("button", { name: /Concerto/ }).first().click();
  await seen(A, /Modifica evento/);
  await A.getByText("In evidenza").last().scrollIntoViewIfNeeded().catch(() => {});
  await A.getByRole("switch", { name: "In evidenza" }).click().catch(async () => {
    await A.getByLabel("In evidenza").last().click();
  });
  await exact(A, "Salva").click();
  await settle(A, 900);
  await back(A);
  await goTab(A, "Home");
  await settle(A, 900);
  check("In evidenza: un solo evento è in primo piano in Home (Concerto)", (await A.getByTestId("home-countdown-line").innerText()).includes("Concerto"));
  await shot(A, "A", "home-evento-in-evidenza");
  // cancellazione con conferma
  await goTab(A, "Noi");
  await exact(A, "Manca poco").click();
  await A.getByRole("button", { name: /Concerto/ }).first().click();
  await seen(A, /Modifica evento/);
  await exact(A, "Cancella evento").click();
  check("Cancella evento: chiede conferma", await seen(A, /Cancellare «Concerto»\?/));
  await shot(A, "A", "evento-conferma-cancella");
  await exact(A, "Sì, cancella").click();
  await settle(A, 900);
  check("Cancella evento: sparisce dalla lista", (await count(A, /Concerto/)) === 0);
  await back(A);

  // ---------- 3. DOMANDA DEL GIORNO VERA ----------
  await goTab(A, "Home");
  await A.getByRole("button", { name: /^Domanda del giorno/ }).first().click();
  await seen(A, /La domanda di oggi/);
  check("Domanda: la pagina mostra la domanda e la casella di risposta (max 280)", (await A.getByTestId("qa-question-text").innerText()) === qA && (await A.getByTestId("qa-input").count()) === 1);
  await shot(A, "A", "domanda-vuota");
  await A.getByTestId("qa-input").fill("x".repeat(300));
  check("Domanda: la casella si ferma a 280 caratteri", (await A.getByTestId("qa-input").inputValue()).length === 280);
  await A.getByTestId("qa-input").fill("Il mare d'inverno, con te sotto la stessa coperta.");
  await exact(A, "Rispondi").click();
  check("Domanda: A risponde e rivede la sua risposta", await seen(A, /Il mare d'inverno/));
  check("Domanda: A aspetta Nikole", await seen(A, /Hai risposto\. Appena risponde Nikole/));
  await shot(A, "A", "domanda-risposto-attesa");
  await settle(B, 1500);
  await B.getByRole("button", { name: /^Domanda del giorno/ }).first().click();
  await seen(B, /La domanda di oggi/);
  check("Segreto: B vede che Leonardo ha già risposto…", await seen(B, /Leonardo ha già risposto/, 12000));
  const leak = await B.evaluate(async (ref) => JSON.stringify(await window.__fragolinaMock.getQa(ref)), "q001");
  check("Segreto: …ma il testo della risposta non è nel server per lui (nemmeno nei dati)", !leak.includes("mare d'inverno"), leak.slice(0, 200));
  check("Segreto: B non lo vede nemmeno a schermo", (await count(B, /Il mare d'inverno/)) === 0);
  await shot(B, "B", "domanda-segreta");
  await B.getByTestId("qa-input").fill("La montagna, sempre.");
  await exact(B, "Rispondi").click();
  await settle(B, 1500);
  check("Rivelazione: B risponde e vede la carta da girare", (await B.getByRole("button", { name: "Gira" }).count()) > 0);
  await shot(B, "B", "domanda-carta");
  await exact(B, "Gira").click();
  await settle(B, 1200);
  check("Rivelazione: B legge le due risposte affiancate", (await B.getByTestId("qa-theirs-text").innerText()).includes("mare d'inverno") && (await B.getByTestId("qa-mine-text").innerText()).includes("montagna"));
  await shot(B, "B", "domanda-rivelata");
  check("Rivelazione in tempo reale: A riceve le risposte senza ricaricare", await seen(A, /Ora le leggete insieme/, 15000));
  await exact(A, "Gira").click();
  await settle(A, 1200);
  check("Rivelazione: A legge la risposta di Nikole", (await A.getByTestId("qa-theirs-text").innerText()).includes("montagna"));
  await shot(A, "A", "domanda-rivelata");
  // domanda di domani: chi tocca?
  const aTurn = (await A.getByText("Domani la domanda la scrivi tu.").count()) > 0;
  const W1 = aTurn ? A : B;
  const W2 = aTurn ? B : A;
  const name2 = aTurn ? "Leonardo" : "Nikole";
  check("Domani: a turno, solo uno dei due può scrivere (l'altro vede chi)", (await W1.getByText("Domani la domanda la scrivi tu.").count()) === 1 && (await W2.getByText(new RegExp(`Domani la scrive ${aTurn ? "Leonardo" : "Nikole"}`)).count()) === 1);
  await W1.getByLabel("Domani", { exact: true }).fill("Qual è la cosa più bella che ti è successa questa settimana?");
  await exact(W1, "Metti per domani").click();
  await settle(W1, 1000);
  check("Domani: la domanda scritta si vede a chi l'ha scritta", await seen(W1, /Hai scritto: Qual è la cosa più bella/));
  check("Domani: l'altro vede che è già pronta (senza spoiler)", (await seen(W2, new RegExp(`${aTurn ? "Leonardo" : "Nikole"} ha già scritto la domanda di domani`), 15000)) && (await count(W2, /cosa più bella/)) === 0);
  await W1.evaluate(() => window.scrollTo(0, 0));
  await shot(W2, aTurn ? "B" : "A", "domani-pronta");

  // archivio: due giorni passati inseriti nel finto server (come se fossero successi ieri e l'altro ieri)
  await A.evaluate(() => {
    const k = "fragolina.mock.server.v1";
    const st = JSON.parse(localStorage.getItem(k));
    const cid = Object.keys(st.couples)[0];
    const [uA, uB] = st.members.filter((m) => m.coupleId === cid).sort((a, b) => a.role.localeCompare(b.role)).map((m) => m.userId);
    const day = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
    st.extra.qaDays.push({ coupleId: cid, day: day(2), ref: "q001", custom: null, setBy: null }, { coupleId: cid, day: day(3), ref: "q002", custom: null, setBy: null });
    for (const [d, a, b] of [[2, "Un caffè sul balcone, il primo giorno di sole.", "La pizza condivisa."], [3, "Il treno delle sei.", "Il mare di maggio."]])
      st.extra.qaAnswers.push({ coupleId: cid, userId: uA, day: day(d), text: a, at: Date.now() - d * 86400000 }, { coupleId: cid, userId: uB, day: day(d), text: b, at: Date.now() - d * 86400000 });
    localStorage.setItem(k, JSON.stringify(st));
  });
  await offline(A, true);
  await offline(A, false);
  await A.goto(base, { waitUntil: "networkidle" });
  await settle(A, 2500);
  await A.getByRole("button", { name: /^Domanda del giorno/ }).first().click();
  await seen(A, /La domanda di oggi/);
  check("Archivio: le domande passate con le risposte di tutti e due", (await A.getByTestId(/archive-/).count()) >= 2);
  await A.getByLabel("Cerca una parola").fill("mare");
  await settle(A, 500);
  check("Archivio: cerca per parola ('mare' trova solo il giorno con 'Il mare di maggio')", (await A.getByTestId(/archive-/).count()) === 1 && (await seen(A, /Il mare di maggio/, 2000)));
  await A.getByLabel("Cerca una parola").fill("zzzz");
  check("Archivio: parola che non c'è, messaggio gentile", await seen(A, /Nessuna domanda con questa parola/, 3000));
  await A.getByLabel("Cerca una parola").fill("");
  await A.evaluate(() => document.querySelector('[data-testid^="archive-"]')?.scrollIntoView());
  await shot(A, "A", "archivio");

  // ---------- 4. RICORDI ----------
  await back(A);
  await goTab(A, "Noi");
  await exact(A, "Ricordi").click();
  await seen(A, /Il vostro album/);
  await seen(A, /Domanda del giorno ·/);
  check("Ricordi: le due domande dell'archivio e quella di oggi sono già nell'album (risposte rivelate)", (await A.getByText(/Domanda del giorno ·/).filter({ visible: true }).count()) >= 2);
  await shot(A, "A", "ricordi-con-domande");
  await pickPhoto(A, "Roma, il nostro giorno");
  check("Foto: la foto scelta si vede in anteprima, con didascalia e giorno", (await seen(A, /Metti nell'album/)) && (await A.getByLabel("Didascalia (facoltativa)").inputValue()) === "Roma, il nostro giorno");
  await shot(A, "A", "foto-anteprima");
  await exact(A, "Metti nell'album").click();
  await settle(A, 2500);
  check("Foto: compare nell'album di A", (await A.getByLabel(/Foto: Roma, il nostro giorno/).count()) > 0);
  await shot(A, "A", "ricordi-foto");
  const stored = await A.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("fragolina.mock.server.v1") || "{}");
    const f = Object.entries(st.extra?.files ?? {});
    return { n: f.length, size: f[0] ? f[0][1].length : 0, head: f[0] ? f[0][1].slice(0, 22) : "", path: f[0]?.[0] ?? "", cid: Object.keys(st.couples)[0] };
  });
  check("Foto: il file è nella cartella della coppia, in JPEG (ridimensionata e compressa)", stored.n === 1 && stored.head.startsWith("data:image/jpeg") && stored.path.startsWith(stored.cid + "/"), JSON.stringify(stored).slice(0, 160));
  check("Foto: pesa meno di 500 KB", stored.size * 0.75 < 500 * 1024, String(Math.round((stored.size * 0.75) / 1024)) + " KB");
  await goTab(B, "Noi");
  await exact(B, "Ricordi").click();
  check("Foto: B la vede (URL firmato, anche in tempo reale)", await seen(B, /Roma, il nostro giorno/, 20000));
  await settle(B, 1500);
  const bImg = await B.evaluate(() => [...document.images].map((i) => ({ w: i.naturalWidth, src: i.currentSrc.slice(0, 20) })).filter((i) => i.w > 100));
  check("Foto: B ha davvero caricato l'immagine", bImg.length > 0, JSON.stringify(bImg));
  await shot(B, "B", "ricordi-foto");
  // B apre la foto: non può cancellarla (non è sua)
  await B.getByLabel(/Foto: Roma, il nostro giorno/).first().click();
  await seen(B, /Solo chi l'ha messa può cancellarla/);
  check("Foto: B può guardarla ma non cancellarla (solo chi l'ha caricata)", (await B.getByRole("button", { name: "Cancella foto" }).count()) === 0);
  await shot(B, "B", "foto-aperta");
  await B.keyboard.press("Escape");
  // offline: B aggiunge una foto senza rete → 'in coda' → al ritorno arriva ad A
  await B.evaluate(() => document.body.click());
  await offline(B, true);
  await settle(B, 400);
  await B.goto(base, { waitUntil: "networkidle" }).catch(() => {});
  await settle(B, 2500);
  await offline(B, true);
  await goTab(B, "Noi");
  await exact(B, "Ricordi").click();
  await pickPhoto(B, "Senza rete");
  await exact(B, "Metti nell'album").click();
  await settle(B, 2000);
  check("Offline: la foto di B si vede subito, con 'in coda'", (await B.getByLabel(/Foto: Senza rete/).count()) > 0 && (await seen(B, /in coda/, 4000)));
  await shot(B, "B", "foto-in-coda");
  check("Offline: A non la vede ancora", (await count(A, /Senza rete/)) === 0);
  await offline(B, false);
  check("Ritorno: la foto parte (upload poi registrazione) e arriva ad A", await seen(A, /Senza rete/, 60000));
  // A cancella la sua foto con conferma → sparisce anche dallo Storage
  await A.getByLabel(/Foto: Roma, il nostro giorno/).first().click();
  await seen(A, /Cancella foto/);
  await exact(A, "Cancella foto").click();
  check("Cancella foto: chiede conferma", await seen(A, /Cancellare\? Sparisce per tutti e due, anche dal server\./));
  await shot(A, "A", "foto-conferma-cancella");
  await exact(A, "Sì, cancella").click();
  await settle(A, 2000);
  const afterDel = await A.evaluate(() => {
    const st = JSON.parse(localStorage.getItem("fragolina.mock.server.v1") || "{}");
    return { files: Object.keys(st.extra?.files ?? {}), mems: (st.extra?.memories ?? []).filter((m) => !m.deleted).map((m) => m.caption) };
  });
  check("Cancella foto: sparisce dall'album, dal registro e dallo Storage", (await count(A, /Roma, il nostro giorno/)) === 0 && !afterDel.mems.includes("Roma, il nostro giorno") && afterDel.files.length === 1, JSON.stringify(afterDel));
  check("Cancella foto: sparisce anche da B", await B.getByLabel(/Foto: Roma, il nostro giorno/).count().then((c) => c === 0), "");
  // "Tieni nei ricordi": un biglietto-scritta
  await goTab(A, "Disegna");
  await btn(A, "Scritta").click();
  await A.getByLabel("Testo del biglietto").fill("Ti penso sempre");
  await exact(A, "Manda").click();
  await settle(A, 2500);
  await A.getByRole("button", { name: "Tieni nei ricordi" }).first().click();
  await settle(A, 1500);
  check("Tieni nei ricordi: dal biglietto sul blocco", (await A.getByLabel("Tenuto nei ricordi").count()) > 0);
  await shot(A, "A", "biglietto-tenuto");
  await goTab(B, "Home").catch(() => {});
  await exact(B, "Ricordi").first().click().catch(() => {});
  await B.goto(base + "/memories", { waitUntil: "networkidle" }).catch(() => {});
  await settle(B, 2500);
  check("Tieni nei ricordi: B lo vede nell'album", await seen(B, /Biglietto di Leonardo/, 15000));
  // un anno fa oggi: una foto datata un anno fa
  await goTab(A, "Noi").catch(() => {});
  await exact(A, "Ricordi").click();
  await pickPhoto(A, "Un anno fa");
  await exact(A, "Anno +").click().catch(() => {});
  await A.getByLabel("Anno −").click();
  await exact(A, "Metti nell'album").click();
  await settle(A, 2500);
  await back(A);
  await goTab(A, "Home");
  await settle(A, 1500);
  check("Un anno fa oggi: compare in Home solo quando c'è qualcosa", await seen(A, /Un anno fa oggi/, 8000));
  await fullShot(A, "A", "home-un-anno-fa");
  await B.goto(base, { waitUntil: "networkidle" });
  await settle(B, 2500);
  check("Un anno fa oggi: anche B lo vede", await seen(B, /Un anno fa oggi/, 10000));

  // ---------- 5. IL NOSTRO MESE ----------
  await goTab(A, "Home");
  await exact(A, "Il nostro mese").click();
  await seen(A, /Gli umori|Il nostro mese/);
  await settle(A, 1500);
  const mp = await A.getByTestId("month-pensieri-tuoi").innerText().catch(() => "?");
  check("Il nostro mese: i pensieri, gli umori, le partite (adesivi e numeri grandi)", (await A.getByTestId("month-partite").count()) === 1 && (await A.getByTestId("month-domande").count()) === 1, mp);
  check("Il nostro mese: 'domande insieme' conta il giorno in cui avete risposto entrambi (+2 inseriti)", (await A.getByTestId("month-domande").innerText()).trim() >= "1");
  await fullShot(A, "A", "il-nostro-mese");
  await exact(A, "Mese precedente").click();
  await settle(A, 1200);
  await shot(A, "A", "mese-precedente");
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
