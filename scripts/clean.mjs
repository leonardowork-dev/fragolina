// Pulisce cache e cartelle generate (non tocca node_modules né il codice). Windows/Mac/Linux.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [".expo", "ios", "dist", "web-build", "out", "docs/shots/tmp"];
for (const t of targets) {
  const p = path.join(root, t);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log("rimosso", t);
  }
}
console.log("Fatto. Per pulire anche le dipendenze: elimina node_modules e lancia npm install.");
