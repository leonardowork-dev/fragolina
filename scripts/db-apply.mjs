// Applica in ordine i file supabase/sessioneN-*.sql non ancora applicati, tracciati in public.app_migrations.
// I file sono ripetibili (idempotenti). Uso: npm run db:apply [-- --force sessione7-extra.sql] [-- --status]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
import { root, loadEnvLocal, redact } from "./lib-env.mjs";

const env = { ...loadEnvLocal(), ...process.env };
const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error("Manca SUPABASE_DB_URL in .env.local. Esegui: SUPABASE_DB_PASSWORD='...' npm run db:setup");
  process.exit(2);
}
const args = process.argv.slice(2);
const statusOnly = args.includes("--status");
const forced = new Set(args.filter((a) => a.endsWith(".sql")));

const dir = path.join(root, "supabase");
const files = fs
  .readdirSync(dir)
  .filter((f) => /^sessione\d+-.*\.sql$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await c.connect();
  await c.query(`create table if not exists public.app_migrations (
    name text primary key,
    sha256 text not null,
    applied_at timestamptz not null default now()
  )`);
  // tabella interna: nessun accesso dai telefoni (RLS attiva, nessuna policy)
  await c.query("alter table public.app_migrations enable row level security");
  const done = new Map((await c.query("select name, sha256 from public.app_migrations")).rows.map((r) => [r.name, r.sha256]));

  // Se il database ha già l'oggetto-guida di una migrazione ma non è tracciata (applicata a mano), la segno come applicata
  // solo se il file è identico a quello che ho; altrimenti la riapplico (i file sono ripetibili).
  let applied = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const sha = crypto.createHash("sha256").update(sql).digest("hex");
    const prev = done.get(f);
    if (statusOnly) {
      console.log(`${prev === sha ? "applicato   " : prev ? "CAMBIATO     " : "da applicare"}  ${f}`);
      continue;
    }
    if (prev === sha && !forced.has(f)) {
      console.log(`= ${f} già applicato`);
      continue;
    }
    process.stdout.write(`> ${f} ... `);
    try {
      await c.query("begin");
      await c.query(sql);
      await c.query(
        "insert into public.app_migrations(name, sha256) values ($1,$2) on conflict (name) do update set sha256 = excluded.sha256, applied_at = now()",
        [f, sha],
      );
      await c.query("commit");
      console.log("ok");
      applied++;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      console.log("ERRORE");
      console.error(redact(e.message, url) + (e.position ? ` (posizione ${e.position})` : ""));
      process.exitCode = 1;
      break;
    }
  }
  if (!statusOnly && !process.exitCode) {
    // ricarica la cache dello schema di PostgREST così le nuove funzioni sono subito visibili
    await c.query("notify pgrst, 'reload schema'").catch(() => {});
    console.log(`Fatto. Applicati ora: ${applied}.`);
  }
} catch (e) {
  console.error("Connessione al database fallita:", redact(e.message, url));
  process.exitCode = 1;
} finally {
  await c.end().catch(() => {});
}
