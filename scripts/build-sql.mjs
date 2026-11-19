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

// Solo la migrazione dei giochi (sessione 6).
const giochiFile = files.find((f) => f.includes("_giochi"));
if (giochiFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DEI MINI GIOCHI (sessione 6). Generato da scripts/build-sql.mjs: non modificarlo a mano.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non tocca nulla di ciò che c'è già.
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione6-giochi.sql"), head + "\n" + fs.readFileSync(path.join(dir, giochiFile), "utf8"));
  console.log("supabase/sessione6-giochi.sql: solo la migrazione dei giochi");
}

// Solo la migrazione della sessione 7 (conto alla rovescia, domanda vera, ricordi + Storage).
const extraFile = files.find((f) => f.includes("_extra7"));
if (extraFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 7: CONTO ALLA ROVESCIA, DOMANDA DEL GIORNO VERA, RICORDI (FOTO) E IL NOSTRO MESE.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Crea anche il contenitore privato delle foto ("memories") e le sue regole.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non cancella nulla di ciò che c'è già
-- (le risposte alla domanda del giorno già date vengono copiate nel nuovo formato).
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione7-extra.sql"), head + "\n" + fs.readFileSync(path.join(dir, extraFile), "utf8"));
  console.log("supabase/sessione7-extra.sql: solo la migrazione della sessione 7");
}
