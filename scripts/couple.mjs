// Chiude/riapre la creazione di nuove coppie e mostra lo stato della coppia. Uso:
//   npm run couple:close | couple:open | couple:status
// Usa SUPABASE_DB_URL (solo in .env.local). Non stampa mai la stringa di connessione.
import pg from "pg";
import { loadEnvLocal } from "./lib-env.mjs";

const env = { ...loadEnvLocal(), ...process.env };
const url = env.SUPABASE_DB_URL;
const cmd = process.argv[2];
if (!url || !["close", "open", "status"].includes(cmd)) {
  console.error(url ? "Uso: node scripts/couple.mjs close|open|status" : "Manca SUPABASE_DB_URL in .env.local (vedi CLAUDE.md, db:setup).");
  process.exit(2);
}
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await db.connect();
try {
  const isClosed = async () => (await db.query("select value from public.app_settings where key='closed'")).rows[0]?.value === "true";
  if (cmd === "close") {
    await db.query("insert into public.app_settings(key,value) values ('closed','true') on conflict (key) do update set value='true'");
    console.log("Chiuso: nessuno può più creare una nuova coppia. (Chi è già dentro non cambia; il codice per entrare resta valido finché la coppia ha un posto libero.)");
  } else if (cmd === "open") {
    await db.query("delete from public.app_settings where key='closed'");
    console.log("Riaperto: si possono creare nuove coppie.");
  } else {
    console.log("Creazione di nuove coppie:", (await isClosed()) ? "CHIUSA" : "aperta");
    const couples = (await db.query(`select c.id, c.created_at,
        (select count(*)::int from public.couple_members m where m.couple_id = c.id) as members
      from public.couples c order by c.created_at`)).rows;
    console.log("Coppie:", couples.length);
    for (const c of couples) {
      const ms = (await db.query("select display_name, role, joined_at, app_expires_at from public.couple_members where couple_id=$1 order by role", [c.id])).rows;
      const last = (await db.query(`select greatest(
          (select max(created_at) from public.pings where couple_id=$1),
          (select max(created_at) from public.mood_events where couple_id=$1)) as t`, [c.id])).rows[0].t;
      console.log(`- membri: ${c.members}/2 (${ms.map((m) => `${m.display_name} [${m.role}]${m.app_expires_at ? ", scade " + new Date(m.app_expires_at).toISOString().slice(0, 10) : ""}`).join(", ") || "nessuno"})`);
      console.log(`  ultima attività: ${last ? new Date(last).toISOString() : "nessuna"}`);
    }
  }
} finally {
  await db.end();
}
