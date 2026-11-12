// Unisce supabase/migrations/*.sql in supabase/all.sql (da incollare nell'editor SQL di Supabase).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const head = `-- Fragolina · TUTTO IL DATABASE IN UN FILE (generato da scripts/build-sql.mjs: non modificarlo a mano).
-- Incolla tutto nell'editor SQL di Supabase e premi Run. Si può rilanciare quante volte vuoi.
`;
const body = files.map((f) => `\n-- ===== ${f} =====\n` + fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
fs.writeFileSync(path.join(root, "supabase", "all.sql"), head + body);
console.log(`supabase/all.sql: ${files.length} migrazioni, ${(head + body).length} caratteri`);
