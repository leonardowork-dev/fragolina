// Unisce supabase/migrations/*.sql in supabase/all.sql (da incollare nell'editor SQL di Supabase).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase", "migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const head = `-- Fragolina · TUTTO IL DATABASE IN UN FILE (generato da scripts/build-sql.mjs: non modificarlo a mano).
-- Incolla tutto nell'editor SQL di Supabase e premi Run. Si può rilanciare quante volte vuoi.
`;
const body = files
  .map((f) => `\n-- ===== ${f} =====\n` + fs.readFileSync(path.join(dir, f), "utf8"))
  .join("\n");
fs.writeFileSync(path.join(root, "supabase", "all.sql"), head + body);
console.log(`supabase/all.sql: ${files.length} migrazioni, ${(head + body).length} caratteri`);

// Solo la migrazione del pet (sessione 4): per chi ha già eseguito all.sql e non deve rifare il vecchio.
const petFile = files.find((f) => f.includes("_pet"));
if (petFile) {
  const petHead = `-- Fragolina · SOLO LA MIGRAZIONE DEL PET (sessione 4). Generato da scripts/build-sql.mjs: non modificarlo a mano.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non tocca nulla di ciò che c'è già.
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione4-pet.sql"), petHead + "\n" + fs.readFileSync(path.join(dir, petFile), "utf8"));
  console.log("supabase/sessione4-pet.sql: solo la migrazione del pet");
}

// Solo la migrazione dei biglietti/distanza/widget (sessione 5).
const noteFile = files.find((f) => f.includes("_note"));
if (noteFile) {
  const noteHead = `-- Fragolina · SOLO LA MIGRAZIONE DEI BIGLIETTI, DELLA DISTANZA E DEL WIDGET (sessione 5). Generato da scripts/build-sql.mjs: non modificarlo a mano.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non tocca nulla di ciò che c'è già.
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione5-note.sql"), noteHead + "\n" + fs.readFileSync(path.join(dir, noteFile), "utf8"));
  console.log("supabase/sessione5-note.sql: solo la migrazione dei biglietti");
}
