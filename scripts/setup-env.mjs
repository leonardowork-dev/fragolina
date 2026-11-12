// Crea (o aggiorna) il file .env.local con i due valori pubblici di Supabase.
// Uso:  npm run setup-env                       → ti chiede i due valori qui nel terminale (incolla e premi Invio)
//       npm run setup-env -- <URL> <CHIAVE>     → senza domande
// Il file è escluso da git (.gitignore: .env*.local). La chiave "anon/publishable" è pubblica per progetto:
// la sicurezza sta nelle regole del database (RLS), non nel tenerla nascosta.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".env.local");

function clean(v) {
  return (v ?? "").trim().replace(/^["']|["']$/g, "");
}
function validUrl(u) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(u);
}
function validKey(k) {
  return /^(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+)$/.test(k);
}

let [url, key] = process.argv.slice(2).map(clean);
if (!url || !key) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("\nIncolla i due valori che hai copiato da Supabase (Project Settings → API).");
  console.log("Per incollare nel terminale di Windows: clic destro del mouse, oppure Ctrl+V.\n");
  url = clean(await rl.question("1) Project URL (inizia con https:// e finisce con .supabase.co): "));
  key = clean(await rl.question("2) Chiave 'anon public' (o 'Publishable key'): "));
  rl.close();
}
if (!validUrl(url)) {
  console.error(`\nIl Project URL non sembra giusto: "${url}".\nDeve essere del tipo https://abcdefgh.supabase.co (senza /rest/v1 in fondo). Riprova.`);
  process.exit(1);
}
if (!validKey(key)) {
  console.error("\nLa chiave non sembra giusta. Deve essere lunga e iniziare con 'eyJ' (anon) oppure 'sb_publishable_'.");
  console.error("Attenzione: NON usare la chiave 'service_role' o 'secret': è privata e non va mai messa nell'app.");
  process.exit(1);
}
url = url.replace(/\/$/, "");

const keep = fs.existsSync(file)
  ? fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim() && !/^EXPO_PUBLIC_SUPABASE_(URL|ANON_KEY)=/.test(l))
  : [];
fs.writeFileSync(file, [...keep, `EXPO_PUBLIC_SUPABASE_URL=${url}`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}`, ""].join("\n"));
console.log(`\nFatto: ${file}`);
console.log("Ora puoi provare il collegamento al database con:  npm run backend:check");
console.log("e mandare la nuova versione dell'app (con i due valori dentro) con:  npm run ship:release");
