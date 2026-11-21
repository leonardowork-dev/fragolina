// Prepara il PC Windows per installare SideStore sui telefoni (una volta sola): controlla iloader e il driver Apple
// (iTunes o «Dispositivi Apple» dallo Store: basta che Sideloadly/iloader veda il telefono; --skip-dependencies evita che winget provi a reinstallare iTunes e fallisca) e, con --install, installa iloader con winget.
// Uso: npm run sidestore:prep [-- --install] [-- --open]   (da WSL; usa powershell.exe)
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const ps = (cmd) => spawnSync("powershell.exe", ["-NoProfile", "-Command", cmd], { encoding: "utf8" });
const out = (r) => (r.stdout || "").trim();

const iloader = out(ps("(Get-Command iloader -ErrorAction SilentlyContinue) -ne $null")) === "True" ||
  out(ps("Test-Path \"$env:LOCALAPPDATA\\iloader\"")) === "True" ||
  /iloader/i.test(out(ps("winget list --id nabdev.iloader 2>$null | Out-String")));
const driver = out(ps("(Get-Service 'Apple Mobile Device Service' -ErrorAction SilentlyContinue).Status"));
console.log(`iloader: ${iloader ? "installato" : "MANCA"}`);
console.log(`Driver Apple (Apple Mobile Device Service): ${driver || "MANCA (serve iTunes dal sito Apple o l'app Dispositivi Apple)"}`);

if (!iloader && args.includes("--install")) {
  console.log("Installo iloader con winget (può comparire la richiesta di Windows: Sì)…");
  const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", "winget install --id nabdev.iloader -e --skip-dependencies --accept-package-agreements --accept-source-agreements"], { stdio: "inherit" });
  console.log(r.status === 0 ? "iloader installato." : `winget è uscito con ${r.status}: installa a mano da https://github.com/nab138/iloader/releases`);
}
if (!driver) console.log("Driver: scarica iTunes da https://www.apple.com/it/itunes/ (versione per Windows, NON dal Microsoft Store) oppure installa «Dispositivi Apple» dal Microsoft Store.");
if (args.includes("--open")) {
  ps("Start-Process 'https://docs.sidestore.io/docs/installation/install'");
  ps("Start-Process 'explorer.exe' -ArgumentList 'C:\\Users\\UTENTE\\OneDrive\\Desktop\\Fragolina-build'");
}
console.log("\nPassi (una volta per telefono): collega il telefono → apri iloader → accedi con l'Apple ID di QUEL telefono → «Install SideStore (Stable)».");
console.log("Poi sul telefono: Impostazioni → Generali → VPN e gestione dispositivo → Autorizza; Modalità sviluppatore (Privacy e sicurezza); LocalDevVPN → Connect; SideStore → accedi → + → Fragolina-release.ipa.");
