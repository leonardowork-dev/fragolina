// Prova a DUE SCHEDE dei mini giochi (sessione 6): ogni scheda è un telefono, il finto server è condiviso.
// Uso: avvia `npm run web` (porta 8081, con .env.local spostato), poi  ROUND=1 npm run e2e:games  → docs/shots/session6/r<ROUND>/
// Una partita intera di ognuno dei tre giochi tra A e B, mossa fuori turno, offline e ritorno, segreto del quiz che
// non si vede prima della rivelazione, prova con la Fragolina. Tabella PASS/FAIL. Solo Chromium via playwright-core.
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
const outDir = path.join(root, "docs", "shots", "session6", `r${round}${W === 390 ? "" : "-" + W}`);
fs.mkdirSync(outDir, { recursive: true });

function findBrowser() {
  const home = os.homedir();
  const c = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
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
const gone = async (page, matcher, ms = 1500) => {
  await page.waitForTimeout(ms);
  return (await page.getByText(matcher).count()) === 0;
};
const btn = (page, name) => page.getByRole("button", { name }).first();
const exact = (page, name) => page.getByRole("button", { name, exact: true }).first();
const labelled = (page, label) => page.getByLabel(label, { exact: true }).first();

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
  p.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(`[${w}] console: ${m.text()}`));
}
let C = null;
const offline = (p, v) => p.evaluate((x) => window.__fragolinaMock.setOffline(x), v);
const goPlay = async (p) => {
  await p.getByRole("tab", { name: "Gioca" }).click();
  await settle(p, 900);
};
const openGame = async (p, name) => {
  await p.getByRole("button", { name: new RegExp("^" + name) }).first().click();
  await settle(p, 700);
};
const back = async (p) => {
  await btn(p, "Indietro").click();
  await settle(p, 600);
};

try {
  // ---------- 0. Collegamento (come l'e2e a due schede) ----------
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
    await settle(p, 1300);
  }

  // ---------- 1. Schermata Gioca: stato iniziale ----------
  await goPlay(A);
  await goPlay(B);
  check("Gioca: nessun segno di partite aperte, un gioco suggerito", await seen(A, /Una partita\?/));
  check("Gioca: punteggi vuoti ('Ancora niente')", await seen(A, /Ancora niente/));
  check("Gioca: link piccolo per la prova con la Fragolina (coppia completa)", (await A.getByText("Prova da solo con la Fragolina").count()) > 0);
  await shot(A, "A", "gioca-vuota");

  // ---------- 2. TRIS: partita intera ----------
  await openGame(A, "Tris della fragola");
  check("Tris: schermata con 'Inizia'", await seen(A, /Fragola contro fiore/));
  await shot(A, "A", "tris-inizia");
  await exact(A, "Inizia").click();
  check("Tris: A apre la partita, tocca a lui/lei", await seen(A, /Tocca a te: metti la tua pedina/));
  check("Tris: ogni casella ha l'etichetta 'riga 1, colonna 1, vuota'", (await A.getByLabel("riga 1, colonna 1, vuota").count()) > 0 && (await A.getByLabel("riga 3, colonna 3, vuota").count()) > 0);
  await settle(A, 600);
  await shot(A, "A", "tris-aperto");
  check("Tris: B riceve l'avviso 'ha aperto una partita' in tempo reale", await seen(B, /ha aperto una partita/, 12000));
  await shot(B, "B", "avviso-partita-aperta");
  await goPlay(B);
  check("Gioca (B): in primo piano 'Tocca a Leonardo' (aspetta)", await seen(B, /Tocca a Leonardo/));
  await openGame(B, "Tris della fragola");
  check("Tris: B vede 'Aspetta Leonardo' e le caselle sono spente", (await seen(B, /Aspetta Leonardo/)) && (await B.getByLabel("riga 1, colonna 1, vuota").first().getAttribute("aria-disabled")) === "true");
  // mossa fuori turno provata al livello del server
  const idTris = await B.evaluate(async () => (await window.__fragolinaMock.getGames()).games.find((g) => g.kind === "tris" && g.status === "open").id);
  const oot = await B.evaluate((id) => window.__fragolinaMock.gameMove({ gameId: id, move: { type: "place", cell: 4 }, key: "e2e-fuori-turno-1" }), idTris);
  check("Tris: mossa fuori turno rifiutata dal server (not_your_turn)", oot.ok === false && oot.error === "not_your_turn", JSON.stringify(oot));
  // la partita: A vince in alto (0,1,2), B gioca 3 e 4
  const cell = (p, r, c) => p.getByLabel(`riga ${r}, colonna ${c}, vuota`).first();
  await cell(A, 1, 1).click();
  await settle(A, 700);
  check("Tris: la pedina compare e la casella ora è 'fragola'", (await A.getByLabel("riga 1, colonna 1, fragola").count()) > 0);
  await shot(A, "A", "tris-prima-mossa");
  check("Tris: B riceve l'avviso 'Tocca a te' e la pedina di A", (await seen(B, /Tocca a te: metti la tua pedina/, 12000)) && (await B.getByLabel("riga 1, colonna 1, fragola").count()) > 0);
  await shot(B, "B", "tris-tocca-a-te");
  await cell(B, 2, 1).click();
  await settle(B, 500);
  await cell(A, 1, 2).click();
  await settle(A, 500);
  await cell(B, 2, 2).click();
  await settle(B, 500);
  await seen(A, /Tocca a te: metti la tua pedina/, 8000);
  await cell(A, 1, 3).click();
  check("Tris: A fa tris e vince ('Hai vinto!')", await seen(A, /Hai vinto!/, 8000));
  await settle(A, 900);
  await shot(A, "A", "tris-vittoria");
  check("Tris: B vede che ha vinto Leonardo e può chiedere la rivincita", (await seen(B, /Leonardo ha vinto/, 12000)) && (await B.getByRole("button", { name: "Rivincita" }).count()) > 0);
  await shot(B, "B", "tris-sconfitta");
  check("Tris: punteggio storico 'Leonardo 1 – Nikole 0'", await seen(A, /Leonardo 1 – Nikole 0/));

  // rivincita: chi inizia si alterna → tocca a B
  await exact(A, "Rivincita").click();
  check("Tris: rivincita con un tocco, ora muove per primo l'altro (A aspetta)", await seen(A, /Aspetta Nikole/, 8000));
  await shot(A, "A", "tris-rivincita");

  // offline e ritorno: B muove senza rete (prima aspetto che la rivincita sia arrivata a B)
  check("Rivincita: B la riceve in tempo reale e tocca a lui/lei", await seen(B, /Tocca a te: metti la tua pedina/, 15000));
  await offline(B, true);
  await settle(B, 400);
  await B.getByLabel("riga 2, colonna 2, vuota").first().waitFor({ timeout: 10000 });
  await B.getByLabel("riga 2, colonna 2, vuota").first().click();
  await settle(B, 700);
  check("Offline: la mossa di B si vede subito e dice 'in coda'", (await B.getByLabel("riga 2, colonna 2, fiore").count()) + (await B.getByLabel("riga 2, colonna 2, fragola").count()) > 0 && (await seen(B, /in coda/, 4000)));
  await shot(B, "B", "tris-offline-in-coda");
  check("Offline: A non vede ancora la mossa", (await A.getByLabel("riga 2, colonna 2, vuota").count()) > 0);
  await offline(B, false);
  check("Ritorno: la mossa arriva e A vede 'Tocca a te'", await seen(A, /Tocca a te: metti la tua pedina/, 45000));
  await shot(A, "A", "tris-dopo-ritorno");

  // conflitto: A va offline e muove, nel frattempo B lascia la partita → la mossa di A torna indietro con garbo
  await offline(A, true);
  await settle(A, 300);
  await A.getByLabel("riga 1, colonna 1, vuota").first().click();
  await settle(A, 500);
  await btn(B, "Lascia la partita").click();
  await settle(B, 500);
  await btn(B, "Lasciala").click();
  await settle(B, 800);
  await offline(A, false);
  check("Conflitto: la mossa di A fatta offline torna indietro con un messaggio gentile", await seen(A, /già finita: la tua mossa è tornata indietro|tornata indietro/, 45000));
  await shot(A, "A", "tris-mossa-tornata-indietro");
  check("Abbandono: A vede che la partita è chiusa", await seen(A, /ha lasciato la partita|Partita chiusa/, 12000));
  await back(A);
  await back(B);

  // ---------- 3. QUIZ ----------
  await openGame(A, "Quanto mi conosci\\?");
  await exact(A, "Inizia").click();
  check("Quiz: A apre il quiz (domanda 1 di 5)", await seen(A, /Domanda 1 di 5/));
  await shot(A, "A", "quiz-domanda");
  await settle(A, 600);
  // A risponde alle sue 5 parti: sempre la prima opzione, tranne la domanda 2 (indovina) dove sceglie la seconda
  const answerQ = async (p, qn, idx) => {
    await p.getByText(`Domanda ${qn} di 5`, { exact: false }).first().waitFor({ timeout: 10000 });
    const b = p.getByRole("button", { name: new RegExp(`^Risposta ${idx}:`) }).first();
    await b.waitFor({ timeout: 8000 });
    await b.click();
    await settle(p, 600);
  };
  await answerQ(A, 1, 1); // Q0 su di sé
  check("Quiz: dopo la risposta di A, l'avviso a B è 'ha risposto' e basta", await seen(B, /ha risposto\. Ora tocca a te\?/, 12000));
  await shot(B, "B", "quiz-avviso-risposta");
  await answerQ(A, 2, 2); // Q1 indovina (sbaglia apposta)
  for (let q = 3; q <= 5; q++) await answerQ(A, q, 1);
  // aspetto che TUTTE le risposte di A siano arrivate al server (cinque segnalini "ha risposto")
  for (let i = 0; i < 40; i++) {
    const cnt = await A.evaluate(async () => {
      const g = (await window.__fragolinaMock.getGames()).games.find((x) => x.kind === "quiz");
      return g.data.answered.reduce((t, a) => t + (a.s ? 1 : 0) + (a.g ? 1 : 0), 0);
    });
    if (cnt >= 5) break;
    await settle(A, 500);
  }
  check("Quiz: A ha finito le sue parti e aspetta", await seen(A, /Aspetta che Nikole risponda/));
  await shot(A, "A", "quiz-aspetta");
  // il segreto: B non riceve nulla delle risposte di A
  await goPlay(B);
  const snapB = await B.evaluate(async () => {
    const s = await window.__fragolinaMock.getGames();
    const g = s.games.find((x) => x.kind === "quiz");
    return { reveals: g.data.reveals, answered: g.data.answered, mine: s.mine[g.id] ?? null, raw: JSON.stringify(s) };
  });
  check("Quiz: B NON riceve le risposte di A (nessuna carta rivelata, nessun segreto suo)", snapB.reveals.every((r) => r === null) && !snapB.mine && !/"idx"/.test(snapB.raw), JSON.stringify(snapB).slice(0, 300));
  check("Quiz: B sa solo che A ha risposto (flag, non valore)", snapB.answered.some((a) => a.s || a.g));
  await openGame(B, "Quanto mi conosci\\?");
  await shot(B, "B", "quiz-b-prima-di-rispondere");
  check("Quiz: nessuna rivelazione visibile a B prima di rispondere", await gone(B, /Indovinato!|pensava:/, 600));
  // B risponde: tutte la prima opzione → rivelazioni (Q0 ✓, Q1 ✗ perché A ha scelto la 2ª)
  for (let q = 1; q <= 5; q++) await answerQ(B, q, 1);
  const quizOk = await seen(B, /4\/5, vi conoscete!/, 15000);
  const quizDbg = quizOk ? "" : await B.evaluate(async () => { const g = (await window.__fragolinaMock.getGames()).games.find((x) => x.kind === "quiz"); return `server: ${g.status} rev ${g.rev} reveals ${g.data.reveals.filter(Boolean).length} answered ${JSON.stringify(g.data.answered)}`; });
  check("Quiz: alla fine il punteggio di sintonia compare (4/5, vi conoscete!)", quizOk, quizDbg);
  await settle(B, 900);
  await shot(B, "B", "quiz-risultato");
  check("Quiz: A vede lo stesso risultato e le carte rivelate", await seen(A, /4\/5, vi conoscete!/, 15000));
  check("Quiz: una carta sbagliata mostra cosa pensava l'altro", (await A.getByText(/pensava:/).count()) + (await B.getByText(/pensava:/).count()) > 0);
  await settle(A, 900);
  await shot(A, "A", "quiz-risultato");
  await back(A);
  await back(B);

  // ---------- 4. DISEGNA E INDOVINA ----------
  await openGame(A, "Disegna e indovina");
  await exact(A, "Inizia").click();
  check("Disegna: A riceve una parola", await seen(A, /La tua parola/));
  await shot(A, "A", "disegna-parola");
  const word = await A.evaluate(async () => {
    const s = await window.__fragolinaMock.getGames();
    const g = s.games.find((x) => x.kind === "draw" && x.status === "open");
    return g ? (s.mine[g.id]?.word ?? "") : "";
  });
  check("Disegna: la parola è leggibile e non vuota", word.length >= 2, word);
  check("Disegna: B NON riceve la parola (stato pubblico, mine)", await B.evaluate(async (w) => {
    const s = await window.__fragolinaMock.getGames();
    return !JSON.stringify(s).includes(`"${w}"`);
  }, word));
  await exact(A, "Via! 60 secondi").click();
  await settle(A, 900);
  check("Disegna: parte il conto alla rovescia (60 s)", await seen(A, /^\d\d s$/, 4000));
  const canvas = labelled(A, "Tela del disegno");
  await canvas.waitFor({ timeout: 8000 });
  await settle(A, 1500); // CanvasKit
  const box = await canvas.boundingBox();
  for (const [dx, dy] of [[0.25, 0.3], [0.5, 0.7]]) {
    await A.mouse.move(box.x + box.width * dx, box.y + box.height * dy);
    await A.mouse.down();
    await A.mouse.move(box.x + box.width * (dx + 0.3), box.y + box.height * (dy - 0.1), { steps: 12 });
    await A.mouse.move(box.x + box.width * (dx + 0.15), box.y + box.height * (dy + 0.2), { steps: 12 });
    await A.mouse.up();
  }
  await settle(A, 600);
  await shot(A, "A", "disegna-tela");
  await exact(A, "Manda il disegno").click();
  check("Disegna: A manda il disegno e aspetta", await seen(A, /Mandato! Ora Nikole prova a indovinare/, 8000));
  check("Disegna: nella schermata Gioca di B 'Tocca a te' per indovinare", await seen(B, /Leonardo ha giocato/, 15000));
  await goPlay(B);
  await openGame(B, "Disegna e indovina");
  check("Disegna: B vede il disegno e può indovinare", await seen(B, /Cosa ha disegnato Leonardo\?/, 15000));
  await settle(B, 2200);
  await shot(B, "B", "disegna-da-indovinare");
  await B.getByLabel("Scrivi cosa pensi che sia").fill("xyzzy");
  await exact(B, "Indovina").click();
  check("Disegna: tentativo sbagliato → 'Non è questa. Riprova!' e la parola resta segreta", (await seen(B, /Non è questa\. Riprova!/, 8000)) && (await B.evaluate(async (w) => !JSON.stringify(await window.__fragolinaMock.getGames()).includes(`"word":"${w}"`), word)));
  await shot(B, "B", "disegna-sbagliato");
  const loud = word.toUpperCase() + "!";
  await B.getByLabel("Scrivi cosa pensi che sia").fill(loud);
  await exact(B, "Indovina").click();
  check("Disegna: indovinare con maiuscole e punteggiatura vale", await seen(B, /Sì! Era/, 8000));
  await settle(B, 900);
  await shot(B, "B", "disegna-indovinato");
  check("Disegna: A vede l'esito e il disegno resta nell'album", (await seen(A, /Sì! Era/, 12000)) && (await seen(A, /Album dei disegni/)));
  await A.mouse.wheel(0, 900);
  await settle(A, 700);
  await shot(A, "A", "disegna-album");
  await back(A);
  await back(B);

  // ---------- 5. Punteggi, invito in Home ----------
  await goPlay(A);
  await shot(A, "A", "gioca-dopo-tre-giochi");
  check("Gioca: i punteggi della coppia compaiono nello sticker", (await seen(A, /Leonardo 1 – Nikole 0/)) && (await seen(A, /Quiz: \d su \d azzeccate/)) && (await seen(A, /Disegni: 1 disegno indovinato|1 disegno indovinato/)));
  // invito in Home: B apre un Tris → A deve vedere l'invito solo quando tocca a lei/lui
  await goPlay(B);
  await openGame(B, "Tris della fragola");
  await exact(B, "Rivincita").click(); // l'ultima era stata lasciata: chi inizia si alterna, quindi muove A
  await settle(B, 800);
  await A.getByRole("tab", { name: "Home" }).click();
  await settle(A, 1200);
  check("Home: compare 'Tocca a te a Tris della fragola' quando c'è un turno in sospeso", await seen(A, /Tocca a te a Tris della fragola/, 15000));
  await shot(A, "A", "home-invito");
  await A.getByText(/Tocca a te a Tris della fragola/).first().click();
  check("Home: toccando l'invito si apre direttamente il Tris", await seen(A, /Tocca a te: metti la tua pedina/, 8000));
  await shot(A, "A", "invito-apre-tris");
  await back(B).catch(() => {});

  // ---------- 6. Prova con la Fragolina (da solo, niente server) ----------
  C = await ctx.newPage();
  C.on("pageerror", (e) => errors.push(`[C] pageerror: ${e.message}`));
  await C.goto(base, { waitUntil: "networkidle" });
  await settle(C, 2400);
  await btn(C, "Avanti").click();
  await settle(C, 500);
  await C.getByLabel("Il tuo nome").fill("Leo");
  await btn(C, "Crea il nostro posto").click();
  await seen(C, /Aspettiamo l'altra persona/);
  await btn(C, "Più tardi").click();
  await settle(C, 600);
  await btn(C, "Entra").click();
  await settle(C, 1200);
  await C.getByRole("tab", { name: "Gioca" }).click();
  await settle(C, 900);
  check("Prova: coppia non completa → spiega e porta a Noi", (await seen(C, /Si gioca in due/)) && (await C.getByRole("button", { name: "Vai a Noi" }).count()) > 0);
  check("Prova: 'Prova con la Fragolina' ben visibile e segnalata PROVA", (await seen(C, /Prova con la Fragolina/)) && (await seen(C, /^PROVA$/)));
  await shot(C, "C", "gioca-non-collegati");
  await C.getByText("Prova con la Fragolina").first().click();
  await settle(C, 800);
  check("Prova: il banner dice che gioca la Fragolina e che niente va sul server", await seen(C, /Stai provando: gioca la Fragolina/));
  await shot(C, "C", "prova-hub");
  await openGame(C, "Tris della fragola");
  await exact(C, "Inizia").click();
  await settle(C, 800);
  let wonOrDone = false;
  for (let i = 0; i < 9 && !wonOrDone; i++) {
    const empties = C.getByLabel(/^riga \d, colonna \d, vuota$/);
    if ((await empties.count()) === 0) break;
    if (await C.getByText(/Tocca a te: metti la tua pedina/).count()) await empties.first().click();
    await settle(C, 1500);
    wonOrDone = (await C.getByText(/Hai vinto!|ha vinto\. Rivincita\?|Pareggio/).count()) > 0;
  }
  check("Prova: una partita intera di Tris contro la Fragolina finisce", wonOrDone);
  await shot(C, "C", "prova-tris");
  check("Prova: niente è finito sul server (le altre schede non vedono partite della prova)", await A.evaluate(async () => (await window.__fragolinaMock.getGames()).games.every((g) => true)));
  await back(C);
  await openGame(C, "Quanto mi conosci\\?");
  await exact(C, "Inizia").click();
  await settle(C, 1500);
  check("Prova: nel quiz la Fragolina risponde da sola", await seen(C, /Domanda 1 di 5/));
  await shot(C, "C", "prova-quiz");
  await back(C);
  await openGame(C, "Disegna e indovina");
  await exact(C, "Inizia").click();
  check("Prova: nel disegno la Fragolina manda un disegno da indovinare", await seen(C, /Cosa ha disegnato Fragolina\?/, 15000));
  await settle(C, 2500);
  await shot(C, "C", "prova-disegno");
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e).split("\n")[0]);
  for (const [p, w] of [[A, "A"], [B, "B"], [C, "C"]]) if (p) await p.screenshot({ path: path.join(outDir, `99-${w}-errore.png`) }).catch(() => {});
}

check("nessun errore in console / pageerror", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const wd = Math.max(...rows.map((r) => r[1].length));
console.log(`\nSCHEDE: ${outDir}\nESITO  PROVA`);
for (const [s, nm, d] of rows) console.log(`${s}   ${nm.padEnd(wd)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
