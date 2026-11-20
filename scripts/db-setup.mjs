// Costruisce SUPABASE_DB_URL (Session pooler, IPv4, porta 5432) e la salva SOLO in .env.local.
// Uso: SUPABASE_DB_PASSWORD='...' npm run db:setup     (la password NON viene salvata, solo la stringa risultante)
import pg from "pg";
import { loadEnvLocal, setEnvLocal, redact } from "./lib-env.mjs";

const REF = "xikxkxmsjhllxwvdlqws";
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Manca SUPABASE_DB_PASSWORD (variabile d'ambiente, solo per questa esecuzione).");
  process.exit(2);
}
if (loadEnvLocal().SUPABASE_DB_URL && !process.env.FORCE) {
  console.log("SUPABASE_DB_URL già presente in .env.local (usa FORCE=1 per rifarlo).");
  process.exit(0);
}
// regioni europee prima, poi le altre come ripiego
const regions = ["eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "eu-south-1", "eu-central-2", "eu-south-2"];
const extra = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1"];
const hosts = [];
for (const r of [...regions, ...extra]) for (const n of [0, 1]) hosts.push({ r, host: `aws-${n}-${r}.pooler.supabase.com` });

async function tryHost(h) {
  const url = `postgresql://postgres.${REF}:${encodeURIComponent(password)}@${h.host}:5432/postgres`;
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  c.on("error", () => {});
  try {
    await c.connect();
    await c.query("select 1");
    await c.end();
    return { ok: true, url };
  } catch (e) {
    try { await c.end(); } catch {}
    return { ok: false, msg: redact(e.message, url), code: e.code };
  }
}

let authFail = 0;
for (const h of hosts) {
  const res = await tryHost(h);
  if (res.ok) {
    setEnvLocal("SUPABASE_DB_URL", res.url);
    console.log(`OK: regione ${h.r} (${h.host}). SUPABASE_DB_URL salvata in .env.local.`);
    process.exit(0);
  }
  // "Tenant or user not found" = regione/host sbagliato. Password errata = host giusto ma auth fallita.
  if (/password authentication failed/i.test(res.msg)) {
    console.error(`Host giusto (${h.host}) ma PASSWORD ERRATA.`);
    authFail++;
    process.exit(3);
  }
  console.log(`- ${h.host}: ${res.msg.slice(0, 80)}`);
}
console.error("Nessuna regione ha risposto.");
process.exit(4);
