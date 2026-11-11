// ship: un solo comando per mandare il codice su GitHub, costruire l'IPA e scaricarlo.
// Uso:  npm run ship            (release: l'app completa, funziona da sola sul telefono)
//       npm run ship:dev        (dev-client: serve il PC acceso con `npm run dev`)
//       node scripts/ship.mjs release|dev-client
// Funziona su Windows, Mac e Linux/WSL. Si può rilanciare quando vuoi (idempotente).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const mode = process.argv[2] === "dev" ? "dev-client" : (process.argv[2] ?? "release");
if (!["dev-client", "release"].includes(mode)) fail(`Variante sconosciuta "${mode}". Usa: release oppure dev-client.`);
const REPO_NAME = "fragolina";
const WORKFLOW = "build-ipa.yml";
const ARTIFACT = `Fragolina-${mode}-ipa`;
const buildDir = path.join(root, "build");

const t0 = Date.now();
const stamp = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s]`;
const log = (m) => console.log(`${stamp()} ${m}`);
function fail(m) {
  console.error(`\nERRORE: ${m}\n`);
  process.exit(1);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" && cmd === "gh" ? false : false, ...opts });
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const gh = (args, opts) => run("gh", args, opts);
const git = (args, opts) => run("git", args, opts);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Strumenti
if (git(["--version"]).code !== 0) fail("Git non è installato. Installalo da https://git-scm.com e rilancia.");
if (gh(["--version"]).code !== 0) {
  fail(
    process.platform === "win32"
      ? "GitHub CLI non installata. Apri il Prompt dei comandi e scrivi: winget install --id GitHub.cli  (poi chiudi e riapri la finestra)."
      : "GitHub CLI non installata. Installala da https://cli.github.com e rilancia.",
  );
}
if (git(["rev-parse", "--git-dir"]).code !== 0) fail("Questa cartella non è un repository git.");

// 2) Login GitHub (solo la prima volta)
if (gh(["auth", "status"]).code !== 0) {
  console.log("\n==============================================================");
  console.log("  ACCESSO A GITHUB (una volta sola)");
  console.log("  Segui le istruzioni qui sotto: ti darà un CODICE e un sito.");
  console.log("  Apri il sito, scrivi il codice, premi Authorize.");
  console.log("==============================================================\n");
  const r = spawnSync("gh", ["auth", "login", "--web", "--git-protocol", "https"], { stdio: "inherit" });
  if (r.status !== 0 || gh(["auth", "status"]).code !== 0) fail("Accesso a GitHub non riuscito. Rilancia il comando e riprova.");
}
gh(["auth", "setup-git"]);
log("GitHub: accesso ok");

// 3) Controllo segreti prima di pubblicare
const tracked = git(["ls-files"]).out.split("\n");
const staged = git(["status", "--porcelain"]).out.split("\n").map((l) => l.slice(3));
const bad = [...new Set([...tracked, ...staged])].filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example") || /\.(pem|p12|key|mobileprovision|jks)$/.test(f));
if (bad.length) fail(`File sensibili nel progetto, non li pubblico: ${bad.join(", ")}. Aggiungili a .gitignore e toglili da git.`);

// 4) Repository remoto
if (git(["remote", "get-url", "origin"]).code !== 0) {
  log(`Creo il repository pubblico "${REPO_NAME}" su GitHub...`);
  const r = gh(["repo", "create", REPO_NAME, "--public", "--source", ".", "--remote", "origin"]);
  if (r.code !== 0) fail(`Non riesco a creare il repository: ${r.err}`);
}
const repoUrl = git(["remote", "get-url", "origin"]).out.replace(/\.git$/, "");
log(`Repository: ${repoUrl}`);

// 5) Commit di quel che è cambiato + push
const branch = git(["branch", "--show-current"]).out || "main";
if (git(["status", "--porcelain"]).out) {
  git(["add", "-A"]);
  const c = git(["commit", "-m", "Aggiornamenti (ship)"]);
  if (c.code !== 0) fail(`Commit non riuscito: ${c.err || c.out}`);
  log("Modifiche salvate in un commit");
}
const p = git(["push", "-u", "origin", branch]);
if (p.code !== 0) fail(`Push non riuscito: ${p.err}`);
const sha = git(["rev-parse", "HEAD"]).out;
log(`Codice caricato (${sha.slice(0, 7)})`);

// 6) Avvio build (GitHub a volte parte dal commit precedente se il push è appena arrivato: in quel caso annullo e riprovo)
await sleep(8000); // dà tempo a GitHub di vedere il push
let runId = null;
for (let attempt = 1; attempt <= 3 && !runId; attempt++) {
  log(`Avvio la build "${mode}" su GitHub (di solito 10-20 minuti)...`);
  const started = Date.now() - 5000;
  const trig = gh(["workflow", "run", WORKFLOW, "--ref", branch, "-f", `mode=${mode}`, "-f", `runner=${process.env.SHIP_RUNNER || "macos-26"}`]);
  if (trig.code !== 0) fail(`Non riesco ad avviare la build: ${trig.err}`);
  let found = null;
  for (let i = 0; i < 30 && !found; i++) {
    await sleep(4000);
    const l = gh(["run", "list", "--workflow", WORKFLOW, "--limit", "5", "--json", "databaseId,createdAt,headSha,event"]);
    try {
      found = JSON.parse(l.out || "[]").find((x) => x.event === "workflow_dispatch" && new Date(x.createdAt).getTime() >= started) ?? null;
    } catch {
      /* riprova */
    }
  }
  if (!found) fail("La build è partita ma non riesco a trovarla. Guarda la scheda Actions su GitHub.");
  if (found.headSha !== sha) {
    log(`La build è sul commit ${found.headSha.slice(0, 7)} invece di ${sha.slice(0, 7)}: la annullo e riprovo.`);
    gh(["run", "cancel", String(found.databaseId)]);
    await sleep(8000);
    continue;
  }
  runId = found.databaseId;
}
if (!runId) fail("GitHub continua a partire dal commit sbagliato. Rilancia tra qualche minuto.");
log(`Build avviata: ${repoUrl}/actions/runs/${runId}`);

// 7) Attesa
let state = { status: "queued", conclusion: "" };
let last = "";
for (let i = 0; i < 130; i++) {
  const v = gh(["run", "view", String(runId), "--json", "status,conclusion"]);
  try {
    state = JSON.parse(v.out);
  } catch {
    /* rete: riprova */
  }
  const now = `${state.status}`;
  if (now !== last) log(`Stato build: ${now}`);
  last = now;
  if (state.status === "completed") break;
  await sleep(30000);
}
fs.mkdirSync(buildDir, { recursive: true });
if (state.status !== "completed") fail("La build sta durando troppo (oltre 60 minuti). Controllala su GitHub.");

// 8) Esito
if (state.conclusion !== "success") {
  const logs = gh(["run", "view", String(runId), "--log-failed"]);
  let text = (logs.out || logs.err).replace(/\u001b\[[0-9;]*m/g, "");
  if (!text.trim()) {
    // Nessun log: spesso GitHub non ha trovato un computer macOS libero. Leggo il motivo vero.
    const jobs = gh(["api", `repos/${repoUrl.replace("https://github.com/", "")}/actions/runs/${runId}/jobs`, "--jq", ".jobs[0].id"]);
    const note = jobs.out.trim() ? gh(["api", `repos/${repoUrl.replace("https://github.com/", "")}/check-runs/${jobs.out.trim()}/annotations`, "--jq", ".[].message"]) : { out: "" };
    text = note.out || "";
    if (/not acquired|capacity/i.test(text) && Number(process.env.SHIP_RETRY || 0) < 3) {
      console.error("\nGitHub non ha trovato un computer macOS libero (succede nelle ore di punta). Riprovo da solo...");
      const r = spawnSync(process.execPath, [process.argv[1], ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, SHIP_RETRY: String(Number(process.env.SHIP_RETRY || 0) + 1), SHIP_RUNNER: ["macos-26", "macos-15", "macos-15-intel", "macos-26"][Number(process.env.SHIP_RETRY || 0) + 1] } });
      process.exit(r.status ?? 2);
    }
  }
  fs.writeFileSync(path.join(buildDir, "last-failure.txt"), text);
  const errors = text.split("\n").filter((l) => /error:|##\[error\]|npm error|fatal/i.test(l)).map((l) => l.replace(/^.*?Z /, "")).slice(0, 12);
  console.error(`\nLa build è FALLITA (${state.conclusion}).`);
  console.error(`Log completo salvato in: ${path.join(buildDir, "last-failure.txt")}`);
  console.error(`Pagina della build: ${repoUrl}/actions/runs/${runId}\nPrimi errori:\n  ${errors.join("\n  ") || "(nessuno riconosciuto, apri il file)"}`);
  process.exit(2);
}

// 9) Download + copia sul Desktop
log("Build riuscita. Scarico l'IPA...");
for (const f of fs.existsSync(buildDir) ? fs.readdirSync(buildDir) : []) if (f.endsWith(".ipa")) fs.rmSync(path.join(buildDir, f));
const d = gh(["run", "download", String(runId), "--name", ARTIFACT, "--dir", buildDir]);
if (d.code !== 0) fail(`Download non riuscito: ${d.err}`);
const ipa = fs.readdirSync(buildDir).find((f) => f.endsWith(".ipa"));
if (!ipa) fail("Scaricato, ma non trovo il file .ipa.");
const ipaPath = path.join(buildDir, ipa);
log(`IPA nel progetto: ${ipaPath}`);

function desktopDir() {
  const ps = (cmd) => run("powershell.exe", ["-NoProfile", "-Command", cmd]);
  if (process.platform === "win32" || fs.existsSync("/mnt/c/Windows")) {
    const r = ps("[Environment]::GetFolderPath('Desktop')");
    const win = r.out.replace(/\r/g, "");
    if (r.code === 0 && win) {
      if (process.platform === "win32") return win;
      const w = run("wslpath", ["-u", win]);
      if (w.code === 0) return w.out;
    }
    if (process.platform !== "win32") {
      const users = fs.existsSync("/mnt/c/Users") ? fs.readdirSync("/mnt/c/Users").filter((u) => !["Public", "Default", "Default User", "All Users"].includes(u)) : [];
      for (const u of users) for (const sub of ["OneDrive/Desktop", "Desktop"]) if (fs.existsSync(`/mnt/c/Users/${u}/${sub}`)) return `/mnt/c/Users/${u}/${sub}`;
    }
  }
  return path.join(os.homedir(), "Desktop");
}
try {
  const out = path.join(desktopDir(), "Fragolina-build");
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(ipaPath, path.join(out, ipa));
  let shown = out;
  if (process.platform !== "win32" && fs.existsSync("/mnt/c/Windows")) shown = run("wslpath", ["-w", out]).out || out;
  console.log(`\nFATTO. L'app è pronta qui:\n   ${shown.includes("\\") ? shown + "\\" + ipa : path.join(shown, ipa)}\nOra apri Sideloadly e trascinaci dentro quel file (guida: scripts/SIDELOAD.md).`);
} catch (e) {
  console.log(`\nIPA pronto in ${ipaPath} (non sono riuscito a copiarlo sul Desktop: ${e.message}).`);
}
