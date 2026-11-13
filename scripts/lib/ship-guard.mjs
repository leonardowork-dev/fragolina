// Protezioni di ship.mjs: funzioni piccole e senza effetti collaterali nascosti, così si possono provare.
import fs from "node:fs";

/** Il processo con questo PID esiste ancora? */
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === "EPERM"; // esiste ma non è nostro
  }
}

/** Legge il lock; null se manca o è illeggibile. */
export function readLock(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Prende il lock in modo atomico (flag "wx": fallisce se esiste già).
 * Un lock il cui PID non esiste più è scaduto e viene tolto.
 * Ritorna { ok: true } oppure { ok: false, holder } con i dati della catena attiva.
 */
export function acquireLock(file, info, alive = pidAlive) {
  const body = JSON.stringify({ ...info, startedAt: new Date().toISOString() });
  for (let i = 0; i < 2; i++) {
    try {
      fs.writeFileSync(file, body, { flag: "wx" });
      return { ok: true };
    } catch (e) {
      if (!e || e.code !== "EEXIST") throw e;
      const holder = readLock(file);
      if (holder && alive(holder.pid) && holder.pid !== info.pid) return { ok: false, holder };
      fs.rmSync(file, { force: true }); // lock vecchio o illeggibile: lo tolgo e riprovo
    }
  }
  return { ok: false, holder: readLock(file) };
}

/** Aggiorna il lock (es. quando si conosce lo SHA); solo se è il nostro. */
export function updateLock(file, pid, patch) {
  const cur = readLock(file);
  if (!cur || cur.pid !== pid) return;
  fs.writeFileSync(file, JSON.stringify({ ...cur, ...patch }));
}

/** Libera il lock, ma solo se è il nostro. */
export function releaseLock(file, pid) {
  const cur = readLock(file);
  if (cur && cur.pid === pid) fs.rmSync(file, { force: true });
}

/** Righe di `git status --porcelain` → elenco di file. Ignora il file di lock. */
export function dirtyFiles(porcelain, ignore = [".ship.lock"]) {
  return porcelain
    .split("\n")
    .filter((l) => l.trim())
    // non si può contare sulle colonne: l'output di git può arrivare senza lo spazio iniziale (" M file")
    .map((l) => {
      const m = l.trim().match(/^(\S+)\s+(.*)$/);
      return { code: m ? m[1] : "??", file: (m ? m[2] : l.trim()).replace(/^"|"$/g, "") };
    })
    .filter((x) => !ignore.includes(x.file));
}

/** Testo in italiano semplice per chi ha lavoro non salvato. */
export function dirtyMessage(files) {
  const nome = (c) => (c === "??" ? "nuovo" : c.includes("D") ? "cancellato" : "modificato");
  const righe = files.slice(0, 20).map((f) => `   - ${f.file}  (${nome(f.code)})`);
  if (files.length > 20) righe.push(`   ... e altri ${files.length - 20} file`);
  return [
    "Ci sono file non ancora salvati nella storia del progetto:",
    ...righe,
    "",
    "Non pubblico lavoro a metà. Prima salva il lavoro: chiedi a Claude 'fai commit di tutto'.",
    "(Se sai quello che fai: rilancia con --commit e salvo tutto io, ma pubblica anche i file a metà.)",
  ].join("\n");
}

/** Argomenti: variante (release | dev-client | dev) e flag. */
export function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const pos = argv.filter((a) => !a.startsWith("--"));
  const raw = pos[0] ?? "release";
  return { mode: raw === "dev" ? "dev-client" : raw, commit: flags.has("--commit") };
}

/**
 * Cosa fare con il push, dati HEAD, la punta di origin e se HEAD è antenato di origin.
 *  "skip"   HEAD è già su origin (stesso SHA)
 *  "behind" origin è più avanti di HEAD: non si costruisce lo SHA giusto, serve git pull
 *  "push"   HEAD non è su origin
 */
export function pushDecision(head, originSha, headIsAncestorOfOrigin) {
  if (originSha && head === originSha) return "skip";
  if (originSha && headIsAncestorOfOrigin) return "behind";
  return "push";
}
