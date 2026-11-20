// Legge/scrive .env.local (mai su git). Usato da db-setup.mjs e db-apply.mjs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".env.local");

export function loadEnvLocal() {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function setEnvLocal(key, value) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  const idx = lines.findIndex((l) => l.startsWith(key + "="));
  const row = `${key}=${value}`;
  if (idx >= 0) lines[idx] = row;
  else {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(row, "");
  }
  fs.writeFileSync(file, lines.join("\n"), { mode: 0o600 });
}

// Nasconde la password nei messaggi d'errore.
export function redact(text, url) {
  let t = String(text);
  try {
    const pw = decodeURIComponent(new URL(url).password);
    if (pw) t = t.split(pw).join("***").split(encodeURIComponent(pw)).join("***");
  } catch {}
  return t;
}
