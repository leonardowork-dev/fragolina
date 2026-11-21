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

// Solo la migrazione della sessione 8 (rifinitura: pulizia dei "penso a te" vecchi con archivio dei conteggi).
const rifFile = files.find((f) => f.includes("_rifinitura"));
if (rifFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 8 (rifinitura): pulizia dei "penso a te" più vecchi di 90 giorni, con archivio dei conteggi.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Non perde nulla di ciò che l'app mostra (totali e "Il nostro mese" contano anche l'archivio).
-- Rieseguibile quante volte vuoi. ATTENZIONE: ridefinisce get_state e get_month; se rilanci a mano un file più vecchio (sessione7), rilancia dopo anche questo.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione8-rifinitura.sql"), head + "\n" + fs.readFileSync(path.join(dir, rifFile), "utf8"));
  console.log("supabase/sessione8-rifinitura.sql: solo la migrazione della sessione 8");
}

// Solo la migrazione della sessione 9 (scadenza dell'app, visibile anche all'altra persona).
const scadFile = files.find((f) => f.includes("_scadenza"));
if (scadFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 9: scadenza dell'app (Apple ID gratuito, 7 giorni), scritta da ciascuno e letta dall'altro.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Due colonne nuove su couple_members e due funzioni. Rieseguibile.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione9-scadenza.sql"), head + "\n" + fs.readFileSync(path.join(dir, scadFile), "utf8"));
  console.log("supabase/sessione9-scadenza.sql: solo la migrazione della sessione 9");
}

// Solo la migrazione della sessione 10 (zona privata di coppia).
const zonaFile = files.find((f) => f.includes("_zona"));
if (zonaFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 10: zona privata di coppia (tabelle z_*, senza policy: si passa solo dalle funzioni).
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Rieseguibile.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione10-piccante.sql"), head + "\n" + fs.readFileSync(path.join(dir, zonaFile), "utf8"));
  console.log("supabase/sessione10-piccante.sql: solo la migrazione della sessione 10");
}

// Solo la migrazione della sessione 11 (codice di recupero del posto).
const recFile = files.find((f) => f.includes("_recupero"));
if (recFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 11: codice di recupero del posto (cambio di identità del telefono).
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Rieseguibile.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione11-recupero.sql"), head + "\n" + fs.readFileSync(path.join(dir, recFile), "utf8"));
  console.log("supabase/sessione11-recupero.sql: solo la migrazione della sessione 11");
}

// Solo la migrazione della sessione 11 (pet: 3 pezzi di cibo, esperienza e livelli, guardaroba).
const petLvFile = files.find((f) => f.includes("_pet_livelli"));
if (petLvFile) {
  const head = `-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 11 (pet): cibo a 3 pezzi, esperienza e livelli, guardaroba.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Rieseguibile.
`;
  fs.writeFileSync(path.join(root, "supabase", "sessione11-pet-livelli.sql"), head + "\n" + fs.readFileSync(path.join(dir, petLvFile), "utf8"));
  console.log("supabase/sessione11-pet-livelli.sql: solo la migrazione del pet (livelli)");
}
