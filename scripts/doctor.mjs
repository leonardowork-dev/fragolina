// Controllo dell'ambiente (sola lettura). Windows/Mac/Linux.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "ignore"], cwd: root }).toString().trim(); } catch { return null; } };
let bad = 0;
const row = (ok, label, hint = "") => { if (!ok) bad++; console.log(`${ok ? "OK      " : "DA FARE "} ${label}${!ok && hint ? "  ->  " + hint : ""}`); };

const node = process.versions.node.split(".").map(Number);
row(node[0] >= 20, `Node ${process.versions.node}`, "serve Node 20 o più: https://nodejs.org");
row(!!run("git --version"), "git installato", "installa Git per Windows");
row(fs.existsSync(path.join(root, "node_modules")), "dipendenze installate", "lancia: npm install");
row(fs.existsSync(path.join(root, "assets/icon.png")), "icona generata", "lancia: npm run icons");
row(fs.existsSync(path.join(root, "public/canvaskit.wasm")), "canvaskit.wasm (solo anteprima web)", "lancia: node scripts/setup-web.mjs");
const remote = run("git remote -v");
row(!!remote, "remote GitHub configurato", "vedi MANUAL_TODO.md passo 1");
const expoUser = run("npx --no-install expo whoami");
console.log(`INFO     Expo login: ${expoUser ?? "non effettuato (serve solo per EAS, NON per questo progetto)"}`);
console.log(`INFO     Sideloadly installato? Controllalo a mano: apri Sideloadly (vedi scripts/SIDELOAD.md)`);
console.log(bad ? `\n${bad} cose da sistemare.` : "\nTutto a posto.");
