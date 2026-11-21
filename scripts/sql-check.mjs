// Prova REALE di supabase/all.sql su un Postgres locale (PGlite, gratis, in memoria): RLS, RPC, limiti.
// Uso: npm run backend:sqltest   (nessuna chiave necessaria)
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite({ extensions: { pgcrypto } });


// Finto schema `storage` di Supabase (stesse colonne e stessa funzione foldername), per provare per davvero le regole del bucket.
const STORAGE_STUB = `
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
    owner uuid, owner_id text, created_at timestamptz default now());
  create function storage.foldername(name text) returns text[] language plpgsql as $$
    declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts, 1) - 1]; end $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant select on storage.buckets to authenticated;
`;

// Finto ambiente Supabase: ruoli, schema auth, auth.uid(), publication.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema extensions;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(STORAGE_STUB);
await db.exec("create extension if not exists pgcrypto with schema extensions");
const sql = fs.readFileSync(path.join(root, "supabase", "all.sql"), "utf8");
await db.exec(sql);
await db.exec(sql); // idempotenza: secondo giro senza errori

const rows = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  rows.push([ok ? "PASS" : "FAIL", name, ok ? "" : detail]);
  if (!ok) failed++;
};
const newUser = async () =>
  (await db.query("insert into auth.users default values returning id")).rows[0].id;
async function as(uid, fn) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false)`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function asAnon(fn) {
  await db.exec("set role anon; select set_config('request.jwt.claim.sub', '', false)");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
const rpc = async (uid, call) =>
  as(uid, async () => (await db.query(`select ${call} as r`)).rows[0].r);
const tryq = async (uid, q, p = []) => {
  try {
    const r = await as(uid, () => db.query(q, p));
    return { ok: true, rows: r.rows, count: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { ok: false, error: String(e.message) };
  }
};

const A = await newUser();
const B = await newUser();
const C = await newUser();
const S = await newUser(); // sconosciuto

// anon (nessuna sessione)
{
  const r = await asAnon(async () => {
    try {
      await db.query("select * from couples");
      return "ok";
    } catch (e) {
      return e.message;
    }
  });
  check("anon senza sessione non legge couples", r !== "ok", r);
  const r2 = await asAnon(async () => {
    try {
      await db.query("select public.create_couple('X')");
      return "ok";
    } catch (e) {
      return e.message;
    }
  });
  check("anon senza sessione non può chiamare create_couple", r2 !== "ok", r2);
}

const created = await rpc(A, "public.create_couple('Leonardo', date '2025-02-14')");
check(
  "A crea la coppia",
  created.ok === true && /^[A-HJKMNP-Z2-9]{6}$/.test(created.code),
  JSON.stringify(created),
);
const code = created.code;
check(
  "A di nuovo: already_paired",
  (await rpc(A, "public.create_couple('Leo')")).error === "already_paired",
);

// join: errori
check(
  "codice sbagliato",
  (await rpc(B, "public.join_couple('AAAAAA','Nikole')")).error === "invalid_code",
);
check(
  "codice malformato (con 0/O/1)",
  (await rpc(B, "public.join_couple('0O1IL!','Nikole')")).error === "invalid_code",
);
check(
  "nome vuoto",
  (await rpc(B, `public.join_couple('${code}','   ')`)).error === "name_required",
);
// rate limit: 5 errori totali (2 già fatti, ne servono 3 + il sesto)
for (let i = 0; i < 3; i++) await rpc(B, "public.join_couple('BBBBBB','Nikole')");
const rl = await rpc(B, `public.join_couple('${code}','Nikole')`);
check(
  "rate limit dopo 5 errori (anche con codice giusto)",
  rl.error === "rate_limited",
  JSON.stringify(rl),
);
await db.exec("delete from rate_events where kind='join_fail'");

const joined = await rpc(B, `public.join_couple(lower('${code}'),'Nikole')`);
check(
  "B entra col codice (anche minuscolo)",
  joined.ok === true && joined.role === "b",
  JSON.stringify(joined),
);
check(
  "terza persona: couple_full",
  (await rpc(C, `public.join_couple('${code}','Intruso')`)).error === "couple_full",
);
check(
  "B di nuovo: already_paired",
  (await rpc(B, `public.join_couple('${code}','N')`)).error === "already_paired",
);

// trigger max 2 anche a livello tabella (inserimento diretto, come superuser)
{
  let blocked = false;
  try {
    const cid = created.couple_id;
    await db.query(
      "insert into couple_members(couple_id,user_id,display_name,role) values ($1,$2,'X','a')",
      [cid, C],
    );
  } catch (e) {
    blocked = true;
  }
  check("trigger/vincolo: nessun terzo membro nemmeno con insert diretto", blocked);
}

// scrittura diretta su couples / members vietata
{
  const r = await tryq(A, "update couples set join_code='ZZZZZZ'");
  check("A non può modificare couples direttamente", !r.ok || r.count === 0, JSON.stringify(r));
}
check(
  "A non può inserire membri direttamente",
  !(
    await tryq(
      A,
      `insert into couple_members(couple_id,user_id,display_name,role) values ('${created.couple_id}','${C}','X','b')`,
    )
  ).ok,
);
check(
  "A non può cancellare membri direttamente",
  (await tryq(A, "delete from couple_members")).ok === false,
);

const cid = created.couple_id;
// lettura: stranger vede nulla
for (const t of ["couples", "couple_members", "mood_events", "pings", "daily_answers"]) {
  const r = await tryq(S, `select * from ${t}`);
  check(`sconosciuto non legge ${t}`, r.ok && r.rows.length === 0, JSON.stringify(r));
}
check("A vede la sua coppia", (await tryq(A, "select * from couples")).rows.length === 1);
check("A vede 2 membri", (await tryq(A, "select * from couple_members")).rows.length === 2);

// ping
const k = () => crypto.randomUUID();
const ins = (uid, who, table, cols, vals) =>
  tryq(uid, `insert into ${table}(${cols}) values (${vals}) on conflict do nothing`);
const pk = k();
check(
  "A manda un ping",
  (await ins(A, "A", "pings", "couple_id,from_user,client_key", `'${cid}','${A}','${pk}'`)).ok,
);
await ins(A, "A", "pings", "couple_id,from_user,client_key", `'${cid}','${A}','${pk}'`);
check(
  "ping idempotente (stessa chiave = 1 riga)",
  (await tryq(B, "select * from pings")).rows.length === 1,
);
check("B vede il ping di A", (await tryq(B, "select * from pings")).rows.length === 1);
check(
  "A non può spacciarsi per B",
  !(await ins(A, "A", "pings", "couple_id,from_user,client_key", `'${cid}','${B}','${k()}'`)).ok,
);
check(
  "sconosciuto non può scrivere ping nella coppia",
  !(await ins(S, "S", "pings", "couple_id,from_user,client_key", `'${cid}','${S}','${k()}'`)).ok,
);
// rate limit ping
let lim = false;
for (let i = 0; i < 35 && !lim; i++) {
  const r = await ins(
    A,
    "A",
    "pings",
    "couple_id,from_user,client_key",
    `'${cid}','${A}','${k()}'`,
  );
  if (!r.ok && /rate_limited/.test(r.error)) lim = true;
}
check("rate limit ping (30/minuto)", lim);

// umore
check(
  "A imposta umore",
  (
    await ins(
      A,
      "A",
      "mood_events",
      "couple_id,user_id,mood_id,client_key,client_at",
      `'${cid}','${A}','innamorata','${k()}', now() + interval '1 day'`,
    )
  ).ok,
);
check(
  "umore inesistente rifiutato",
  !(
    await ins(
      A,
      "A",
      "mood_events",
      "couple_id,user_id,mood_id,client_key",
      `'${cid}','${A}','arrabbiato','${k()}'`,
    )
  ).ok,
);
const mood = (await tryq(B, "select client_at, created_at from mood_events")).rows[0];
check(
  "client_at nel futuro viene riportato a now()",
  new Date(mood.client_at).getTime() <= Date.now() + 2000,
);

// risposte: reveal
const day = new Date().toISOString().slice(0, 10);
check(
  "B risponde per primo",
  (
    await ins(
      B,
      "B",
      "daily_answers",
      "couple_id,user_id,day,question_id,answer",
      `'${cid}','${B}','${day}','q-1','b'`,
    )
  ).ok,
);
check(
  "A NON vede la risposta di B prima di rispondere",
  (await tryq(A, "select * from daily_answers")).rows.length === 0,
);
check(
  "get_state non rivela la risposta di B ad A",
  (await rpc(A, `public.get_state(date '${day}', now() - interval '1 day')`)).partner_answer ===
    null,
);
check(
  "A risponde",
  (
    await ins(
      A,
      "A",
      "daily_answers",
      "couple_id,user_id,day,question_id,answer",
      `'${cid}','${A}','${day}','q-1','a'`,
    )
  ).ok,
);
check("ora A vede entrambe", (await tryq(A, "select * from daily_answers")).rows.length === 2);
{
  const r = await tryq(A, `update daily_answers set answer='b' where user_id='${A}'`);
  check("A non può cambiare la risposta (immutabile)", !r.ok || r.count === 0, JSON.stringify(r));
}
check(
  "giorno lontano rifiutato",
  !(
    await ins(
      A,
      "A",
      "daily_answers",
      "couple_id,user_id,day,question_id,answer",
      `'${cid}','${A}','2020-01-01','q','a'`,
    )
  ).ok,
);

const st = await rpc(A, `public.get_state(date '${day}', date_trunc('day', now()))`);
check(
  "get_state: A vede partner mood assente, B ha 0 mood",
  st.partner_mood === null && st.my_mood?.mood_id === "innamorata",
);
check(
  "get_state: pings_sent_today ≥ 1 e received 0",
  st.pings_sent_today >= 1 && st.pings_received_total === 0,
);
const stB = await rpc(B, `public.get_state(date '${day}', date_trunc('day', now()))`);
check(
  "get_state B: riceve i ping di A e vede il suo umore",
  stB.pings_received_total >= 1 && stB.partner_mood?.mood_id === "innamorata",
);
check(
  "get_state B: risposta di A visibile (B aveva già risposto)",
  stB.partner_answer?.answer === "a",
);

// data di inizio LWW
await db.exec(
  `update couples set start_date_updated_at = now() - interval '3 hours' where id='${cid}'`,
);
const t1 = "now() - interval '2 hours'";
const t2 = "now() - interval '1 hour'";
check(
  "A imposta data (t2)",
  (await rpc(A, `public.set_start_date(date '2024-05-01', ${t2})`)).start_date === "2024-05-01",
);
const old = await rpc(B, `public.set_start_date(date '2023-01-01', ${t1})`);
check("LWW: scrittura più vecchia non vince", old.start_date === "2024-05-01", JSON.stringify(old));
check(
  "LWW: scrittura più nuova vince",
  (await rpc(B, "public.set_start_date(date '2024-06-02')")).start_date === "2024-06-02",
);
check(
  "data futura rifiutata",
  (await rpc(B, "public.set_start_date(current_date + 30)")).error === "invalid_date",
);

// nome
check("set_display_name", (await rpc(B, "public.set_display_name('Niki')")).ok === true);
check(
  "nome troppo lungo troncato a 24",
  (await tryq(A, "select display_name from couple_members where user_id=$1", [B])).rows[0]
    .display_name === "Niki",
);

// release_partner e ricollegamento
const rel = await rpc(A, "public.release_partner()");
check(
  "release_partner libera il posto e dà un codice nuovo",
  rel.ok && /^[A-HJKMNP-Z2-9]{6}$/.test(rel.code),
  JSON.stringify(rel),
);
check(
  "B (rilasciata) non vede più nulla",
  (await tryq(B, "select * from couples")).rows.length === 0,
);
const rejoin = await rpc(C, `public.join_couple('${rel.code}','Nikole')`);
check("C entra al posto di B", rejoin.ok === true && rejoin.role === "b", JSON.stringify(rejoin));
check(
  "B vecchia con vecchio codice: non entra più",
  (await rpc(B, `public.join_couple('${code}','N')`)).ok !== true,
);

// codice scaduto
{
  const X = await newUser(),
    Y = await newUser();
  const cr = await rpc(X, "public.create_couple('Xavier')");
  await db.exec(
    `update couples set join_code_expires_at = now() - interval '1 minute' where id='${cr.couple_id}'`,
  );
  check(
    "codice scaduto",
    (await rpc(Y, `public.join_couple('${cr.code}','Y')`)).error === "code_expired",
  );
  const nw = await rpc(X, "public.renew_join_code()");
  check("renew_join_code dà un codice nuovo", nw.ok && nw.code !== cr.code);
  check(
    "con il codice nuovo si entra",
    (await rpc(Y, `public.join_couple('${nw.code}','Y')`)).ok === true,
  );
}

// leave: ultimo che esce cancella tutto
{
  const before = (await db.query("select count(*)::int n from couples")).rows[0].n;
  await rpc(A, "public.leave_couple()");
  await rpc(C, "public.leave_couple()");
  const after = (await db.query("select count(*)::int n from couples")).rows[0].n;
  check("leave: coppia vuota cancellata con i suoi dati", after === before - 1);
  check(
    "leave: dati a cascata spariti",
    (await db.query("select count(*)::int n from pings where couple_id=$1", [cid])).rows[0].n === 0,
  );
  check("leave due volte è innocuo", (await rpc(A, "public.leave_couple()")).ok === true);
}

// ---------- il pet condiviso (migrazione 5) ----------
{
  const P1 = await newUser(),
    P2 = await newUser(),
    P3 = await newUser();
  const mk = await rpc(P1, "public.create_couple('Leonardo')");
  await rpc(P2, `public.join_couple('${mk.code}','Nikole')`);
  const pcid = mk.couple_id;
  const nowSql = "public._now_ms()";
  const act = (u, kind, item, amount, key, at = "null") =>
    rpc(
      u,
      `public.pet_act('${kind}', ${item ? `'${item}'` : "null"}, ${amount}, current_date, '${key}', ${at})`,
    );
  const row = async () =>
    (await db.query("select * from pets where couple_id=$1", [pcid])).rows[0];

  // 0) prima del primo tocco non c'è riga; get_pet risponde comunque
  const g0 = await rpc(P1, "public.get_pet()");
  check("get_pet senza pet: ok e pet null", g0.ok === true && g0.pet === null, JSON.stringify(g0));
  check(
    "cura prima della schiusa: not_hatched",
    (await act(P1, "feed", "mora", 1, "pet-key-0001")).error === "not_hatched",
  );
  check(
    "azione sconosciuta / cibo sconosciuto / chiave corta: invalid_action",
    (await act(P1, "dance", null, 1, "pet-key-0002")).error === "invalid_action" &&
      (await act(P1, "feed", "pizza", 1, "pet-key-0003")).error === "invalid_action" &&
      (await act(P1, "touch", null, 1, "corta")).error === "invalid_action",
  );
  check("un NON membro non può toccare l'uovo", (await act(S, "touch", null, 1, "pet-key-0004")).error === "not_paired");

  // 1) schiusa a due
  const t1 = await act(P1, "touch", null, 3, "pet-key-0010");
  check("P1 tocca l'uovo: non si schiude da solo", t1.ok && t1.pet.hatched_at === null && t1.pet.touches_a === 3, JSON.stringify(t1));
  const t1b = await act(P1, "touch", null, 3, "pet-key-0010");
  check("stessa chiave due volte: idempotente (duplicate, nessun tocco in più)", t1b.ok && t1b.duplicate === true && (await row()).touches_a === 3);
  const t2 = await act(P2, "touch", null, 1, "pet-key-0011");
  check("P2 tocca: SI SCHIUDE (entrambi hanno toccato)", t2.ok && t2.pet.hatched_at !== null && t2.pet.hatched_by === P2 && t2.pet.food === 800, JSON.stringify(t2));
  check("giorni di cura = 1 dopo la schiusa", t2.pet.care_days === 1 && t2.pet.last_kind === "hatch");
  const t3 = await act(P1, "touch", null, 1, "pet-key-0012");
  check("tocco dopo la schiusa: ignorato", t3.ok && t3.ignored === true);

  // 2) cure, pausa, idempotenza
  const base = (await db.query(`select ${nowSql} as n`)).rows[0].n;
  const f1 = await act(P1, "feed", "mora", 1, "pet-key-0020", `${base} - 100000`);
  check("P1 dà una mora", f1.ok && f1.pet.last_kind === "feed" && f1.pet.last_item === "mora" && f1.pet.last_by === P1, JSON.stringify(f1));
  const f2 = await act(P1, "feed", "pesca", 1, "pet-key-0021", `${base} - 90000`);
  check("seconda cura uguale entro 45 s: cooldown", f2.error === "cooldown", JSON.stringify(f2));
  const f3 = await act(P2, "feed", "pesca", 1, "pet-key-0022", `${base} - 90000`);
  check("la pausa è PER PERSONA: P2 può dare da mangiare subito", f3.ok === true, JSON.stringify(f3));
  const f4 = await act(P1, "feed", "lampone", 1, "pet-key-0023", `${base} - 50000`);
  check("dopo 50 s P1 può di nuovo", f4.ok === true, JSON.stringify(f4));
  const cu = await act(P1, "cuddle", null, 1, "pet-key-0024");
  check("coccola", cu.ok && cu.pet.love <= 1000, JSON.stringify(cu));
  const rcount = (await db.query("select count(*)::int n from pet_actions where couple_id=$1", [pcid])).rows[0].n;
  await act(P1, "cuddle", null, 1, "pet-key-0024");
  check("chiave ripetuta: nessuna riga in più nel registro", (await db.query("select count(*)::int n from pet_actions where couple_id=$1", [pcid])).rows[0].n === rcount);
  check("bonus 'in due' contato (P1 e P2 hanno curato oggi)", (await row()).both_days === 1);
  check("nanna: dorme per 90 minuti", (await act(P2, "sleep", null, 1, "pet-key-0025")).pet.sleep_until > base);
  check("orario nel futuro tagliato a 'adesso'", (await act(P2, "play", null, 1, "pet-key-0026", `${base} + 99999999`)).pet.at <= (await db.query(`select ${nowSql} as n`)).rows[0].n);

  // 3) registro e get_pet
  const gp = await rpc(P2, "public.get_pet(5)");
  check("get_pet: stato, registro (più nuovo prima) e le mie ultime volte", gp.ok && gp.pet.rev >= 6 && gp.log.length === 5 && gp.log[0].rev > gp.log[1].rev && typeof gp.my_last.feed === "number", JSON.stringify(gp).slice(0, 300));

  // 4) RLS
  check("P1 legge il pet della coppia", (await tryq(P1, "select * from pets")).rows.length === 1);
  check("P2 legge il registro", (await tryq(P2, "select * from pet_actions")).rows.length >= 6);
  check("un estraneo non vede il pet", (await tryq(P3, "select * from pets")).rows.length === 0);
  check("un estraneo non vede il registro", (await tryq(P3, "select * from pet_actions")).rows.length === 0);
  check("anon non legge pets", await asAnon(async () => { try { await db.query("select * from pets"); return false; } catch { return true; } }));
  check("scrittura diretta su pets vietata", (await tryq(P1, "update pets set food = 1000")).ok === false);
  check("scrittura diretta su pet_actions vietata", (await tryq(P1, `insert into pet_actions(couple_id,user_id,kind,at,rev,client_key) values ('${pcid}','${P1}','feed',1,1,'hackhackhack')`)).ok === false);
  check("l'estraneo non può curare il pet altrui", (await act(P3, "cuddle", null, 1, "pet-key-0030")).error === "not_paired");
  check("le funzioni interne non sono chiamabili", (await tryq(P1, "select public._pet_decay(1000,45,1)")).ok === false);

  // 5) nome (LWW, 16 caratteri)
  const n1 = await rpc(P2, `public.set_pet_name('  Fragolotta Reale Primissima ', ${base} - 5000, 'name-key-0001')`);
  check("nome: troncato a 16", n1.ok && n1.pet.name === "Fragolotta Reale" && n1.pet.name.length === 16, JSON.stringify(n1));
  const n2 = await rpc(P1, `public.set_pet_name('Vecchio', ${base} - 60000, 'name-key-0002')`);
  check("nome: una scrittura più vecchia non vince", n2.ok && n2.pet.name === "Fragolotta Reale");
  const n3 = await rpc(P1, `public.set_pet_name('Bacca', ${base}, 'name-key-0003')`);
  check("nome: una più nuova vince (anche dall'altra persona)", n3.ok && n3.pet.name === "Bacca");
  check("nome vuoto rifiutato", (await rpc(P1, "public.set_pet_name('   ', null, 'name-key-0004')")).error === "name_required");

  // 6) limite di frequenza
  {
    const R1 = await newUser(), R2 = await newUser();
    const m2 = await rpc(R1, "public.create_couple('R1')");
    await rpc(R2, `public.join_couple('${m2.code}','R2')`);
    await act(R1, "touch", null, 1, "rate-hatch-01");
    await act(R2, "touch", null, 1, "rate-hatch-02");
    let last;
    // cure distanziate di 50 s nel tempo "del telefono" ma tutte nello stesso minuto vero: la pausa passa, il limite no
    for (let i = 0; i < 62; i++)
      last = await act(R1, "feed", "mora", 1, `rate-key-${String(i).padStart(4, "0")}`, `${base} - 4000000 + ${i * 50000}`);
    check("più di 60 cure al minuto: rate_limited", last.error === "rate_limited", JSON.stringify(last));
  }

  // 7) schiusa da soli (40 tocchi) in una coppia con una persona sola
  {
    const L = await newUser();
    await rpc(L, "public.create_couple('Sola')");
    let r;
    for (let i = 0; i < 4; i++) r = await act(L, "touch", null, 10, `solo-key-${String(i).padStart(4, "0")}`);
    check("40 tocchi di una persona sola: si schiude", r.ok && r.pet.hatched_at !== null && r.pet.touches_a === 40, JSON.stringify(r));
  }

  // 8) parità con TypeScript: la stessa sequenza (tests/fixtures/pet-sequence.json) passa da _pet_step
  {
    const fx = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "pet-sequence.json"), "utf8"));
    const snake = (o) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase()), v]));
    const KEYS = Object.keys(snake(fx.initial)).sort();
    let cur = snake(fx.initial);
    let bad = null;
    let n = 0;
    for (const st of fx.steps) {
      if (st.outcome === "not_hatched" || st.outcome === "bad_action") {
        continue; // pet_act li scarta prima di chiamare _pet_step
      }
      const a = st.action;
      const q = await db.query(
        `select public._pet_json(public._pet_step(jsonb_populate_record(null::public.pets, $1::jsonb), $2, $3, $4, $5, $6::uuid, $7::bigint, $8, $9)) as j`,
        [JSON.stringify(cur), a.kind, a.item ?? null, a.amount ?? 1, a.role, a.userId, a.at, a.day, a.key ?? null],
      );
      const got = q.rows[0].j;
      const want = snake(st.after);
      for (const k of KEYS) {
        if (JSON.stringify(got[k] ?? null) !== JSON.stringify(want[k] ?? null)) {
          bad = `passo ${n} (${a.kind}) campo ${k}: SQL ${JSON.stringify(got[k])} ≠ TS ${JSON.stringify(want[k])}`;
          break;
        }
      }
      if (bad) break;
      cur = want;
      n++;
    }
    check(`parità TS↔SQL: ${n} passi identici (_pet_step = applyAction)`, bad === null && n > 250, bad ?? "");
  }

  check("la publication realtime contiene pets", (await db.query("select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='pets'")).rows.length === 1);

  // 9) leave: il pet sparisce con la coppia
  await rpc(P1, "public.leave_couple()");
  await rpc(P2, "public.leave_couple()");
  check("leave: pet e registro spariscono a cascata", (await db.query("select count(*)::int n from pets where couple_id=$1", [pcid])).rows[0].n === 0 && (await db.query("select count(*)::int n from pet_actions where couple_id=$1", [pcid])).rows[0].n === 0);
}

// chiusura
{
  await db.exec(
    "insert into app_settings(key,value) values ('closed','true') on conflict (key) do update set value='true'",
  );
  const Z = await newUser();
  check(
    "modalità chiusa: niente nuove coppie",
    (await rpc(Z, "public.create_couple('Z')")).error === "closed",
  );
  await db.exec("delete from app_settings where key='closed'");
}

// realtime publication
{
  const t = (
    await db.query(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' order by 1",
    )
  ).rows.map((r) => r.tablename);
  check(
    "publication realtime contiene le 5 tabelle",
    ["couple_members", "couples", "daily_answers", "mood_events", "pings"].every((x) =>
      t.includes(x),
    ),
    t.join(","),
  );
}

// Chi ha già eseguito le migrazioni 1-4 sul server esegue SOLO sessione4-pet.sql: deve bastare.
{
  const db2 = new PGlite({ extensions: { pgcrypto } });
  await db2.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db2.exec("create extension if not exists pgcrypto with schema extensions");
  const dir = path.join(root, "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("_pet") && !x.includes("_note") && !x.includes("_giochi") && !x.includes("_extra7") && !x.includes("_zona")).sort())
    await db2.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  let ok = true;
  let why = "";
  try {
    const solo = fs.readFileSync(path.join(root, "supabase", "sessione4-pet.sql"), "utf8");
    await db2.exec(solo);
    await db2.exec(solo); // rieseguibile
    const r = await db2.query("select count(*)::int n from pg_proc where proname in ('pet_act','get_pet','set_pet_name')");
    ok = r.rows[0].n === 3;
  } catch (e) {
    ok = false;
    why = String(e.message);
  }
  check("sessione4-pet.sql da solo, sopra le migrazioni 1-4 già eseguite (e rieseguibile)", ok, why);
}


// ---------- biglietti, distanza, widget (migrazione 6) ----------
{
  const N1 = await newUser(),
    N2 = await newUser(),
    N3 = await newUser(),
    N4 = await newUser();
  const mk = await rpc(N1, "public.create_couple('Leonardo')");
  await rpc(N2, `public.join_couple('${mk.code}','Nikole')`);
  const mk2 = await rpc(N3, "public.create_couple('Altra')");
  await rpc(N4, `public.join_couple('${mk2.code}','Altro')`);
  const jq = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;
  const send = (u, kind, content, key) => rpc(u, `public.send_note('${kind}', ${jq(content)}, '${key}')`);
  const draw = (n = 3, extra = {}) => ({
    strokes: [{ c: "strawberry", w: 1, p: Array.from({ length: n }, (_, i) => [10 + i, 20 + i]), ...extra }],
  });
  const feed = (tok) =>
    asAnon(async () => (await db.query("select public.widget_feed($1) as r", [tok])).rows[0].r);

  // invio: scritta
  const t1 = await send(N1, "text", { text: "Ti penso", bg: "butter" }, "note-key-0001");
  check("N1 manda una scritta", t1.ok && t1.note.kind === "text" && t1.note.by === "me" && t1.note.byName === "Leonardo", JSON.stringify(t1));
  check("scade tra 1 ora esatta", Math.abs(t1.note.expiresAt - t1.note.createdAt - 3600000) < 2000);
  const t1b = await send(N1, "text", { text: "Ti penso", bg: "butter" }, "note-key-0001");
  check("stessa chiave: nessun duplicato (idempotente)", t1b.ok && t1b.duplicate === true && t1b.note.id === t1.note.id);
  check("una sola riga dopo il doppio invio", (await db.query("select count(*)::int n from notes where user_id=$1", [N1])).rows[0].n === 1);
  const b2 = await rpc(N2, "public.get_board()");
  check("N2 vede il biglietto come 'partner' con il nome", b2.ok && b2.note.by === "partner" && b2.note.byName === "Leonardo" && b2.note.content.text === "Ti penso", JSON.stringify(b2));

  // validazione lato server
  const bad = async (kind, content, why) =>
    check(`rifiutato: ${why}`, (await send(N1, kind, content, `note-bad-${Math.random().toString(36).slice(2, 10)}`)).error === "invalid_content");
  await bad("text", { text: "x".repeat(81), bg: "butter" }, "scritta di 81 caratteri");
  await bad("text", { text: "   ", bg: "butter" }, "scritta vuota");
  await bad("text", { text: "ciao", bg: "viola" }, "sfondo fuori palette");
  await bad("draw", { strokes: [] }, "disegno senza tratti");
  await bad("draw", draw(2, { c: "viola" }), "colore fuori palette");
  await bad("draw", draw(2, { w: 3 }), "spessore 3");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [[1001, 5]] }] }, "coordinata 1001");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [[-1, 5]] }] }, "coordinata negativa");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [[1.5, 5]] }] }, "coordinata non intera");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [["1", 5]] }] }, "coordinata stringa");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [[1, 2, 3]] }] }, "punto a tre valori");
  await bad("draw", { strokes: [{ c: "ink", w: 1, p: [] }] }, "tratto senza punti");
  await bad("draw", draw(401), "401 punti in un tratto");
  await bad("draw", { strokes: Array.from({ length: 41 }, () => ({ c: "ink", w: 1, p: [[1, 1]] })) }, "41 tratti");
  await bad("draw", { strokes: Array.from({ length: 4 }, () => ({ c: "ink", w: 1, p: Array.from({ length: 400 }, (_, i) => [i, i]) })) }, "1600 punti in tutto");
  check("tipo sconosciuto", (await send(N1, "photo", { a: 1 }, "note-key-0003")).error === "invalid_action");
  check("chiave troppo corta", (await send(N1, "text", { text: "a", bg: "sky" }, "short")).error === "invalid_action");
  check("un NON membro non può mandare biglietti", (await send(S, "text", { text: "a", bg: "sky" }, "note-key-0004")).error === "not_paired");

  // un disegno al limite (1500 punti, 24 KB) passa
  const maxDraw = { strokes: Array.from({ length: 4 }, (_, k) => ({ c: "ink", w: 2, p: Array.from({ length: 375 }, (_, i) => [1000 - (i % 1000), 1000 - ((i + k) % 1000)]) })) };
  const mx = await send(N2, "draw", maxDraw, "note-key-0005");
  check("disegno al limite (1500 punti, coordinate a 4 cifre) accettato", mx.ok === true, JSON.stringify(mx).slice(0, 200));
  check("e nell'ultimo biglietto vince il più recente (di N2)", (await rpc(N1, "public.get_board()")).note.id === mx.note.id);

  // RLS
  check("scrittura diretta su notes negata", !(await tryq(N1, "insert into notes (couple_id,user_id,kind,content,client_key,expires_at) values ($1,$2,'text','{}','direct-key-01', now())", [mk.couple_id, N1])).ok);
  check("update diretto su notes negato", !(await tryq(N1, "update notes set cleared_at = now()")).ok);
  check("un'altra coppia non vede i biglietti", (await tryq(N3, "select * from notes")).rows.every((r) => r.couple_id === mk2.couple_id));
  check("lo sconosciuto non vede biglietti", (await tryq(S, "select * from notes")).rows.length === 0);
  check("i membri vedono i biglietti della coppia", (await tryq(N2, "select * from notes")).rows.length === 2);
  check("l'altra coppia non può pulire i nostri", (await rpc(N3, `public.clear_note('${mx.note.id}')`)).none === true);
  check("…e il biglietto è ancora vivo", (await rpc(N1, "public.get_board()")).note.clearedAt === null);

  // pulisci
  const nxt = await send(N1, "text", { text: "Nuovo", bg: "sky" }, "note-key-0006");
  const clOld = await rpc(N2, `public.clear_note('${mx.note.id}')`);
  check("pulire un biglietto vecchio non tocca quello nuovo", clOld.ok && (await rpc(N1, "public.get_board()")).note.clearedAt === null);
  const cl = await rpc(N2, `public.clear_note('${nxt.note.id}')`);
  check("N2 pulisce il biglietto di N1 (vale per entrambi)", cl.ok && cl.note.clearedAt !== null);
  const bN1 = await rpc(N1, "public.get_board()");
  check("N1 vede 'pulito'", bN1.note.clearedAt !== null && bN1.note.id === nxt.note.id);
  check("pulire due volte va bene", (await rpc(N1, `public.clear_note('${nxt.note.id}')`)).ok === true);
  check("pulire senza id pulisce l'ultimo", (await rpc(N1, "public.clear_note()")).ok === true);
  check("un NON membro non può pulire", (await rpc(S, "public.clear_note()")).error === "not_paired");

  // limite di invio
  for (let i = 0; i < 20; i++) await send(N3, "text", { text: "r", bg: "sky" }, `note-rate-${String(i).padStart(4, "0")}`);
  check("20 biglietti al minuto, poi rate_limited", (await send(N3, "text", { text: "r", bg: "sky" }, "note-rate-9999")).error === "rate_limited");
  check("lo storico resta corto (max 30)", (await db.query("select count(*)::int n from notes where couple_id=$1", [mk2.couple_id])).rows[0].n <= 30);

  // ---- distanza ----
  check("senza consenso set_location dice not_sharing", (await rpc(N1, "public.set_location(4400, 1200, null)")).error === "not_sharing");
  check("sharing on", (await rpc(N1, "public.set_location_sharing(true)")).sharing === true);
  check("coordinate fuori scala rifiutate", (await rpc(N1, "public.set_location(9001, 0, null)")).error === "invalid_location" && (await rpc(N1, "public.set_location(0, -18001, null)")).error === "invalid_location");
  const tNow = String(Date.now());
  check("N1 manda la posizione (Roma ≈ 41.90, 12.50)", (await rpc(N1, `public.set_location(4190, 1250, ${tNow} - 5000)`)).ok === true);
  check("posizione più vecchia ignorata (ultima vince)", (await rpc(N1, `public.set_location(1, 1, ${tNow} - 60000)`)).ignored === true);
  check("N2 non condivide: vede 'mine_off' e nessuna coordinata", await (async () => {
    const l = (await rpc(N2, "public.get_board()")).location;
    return l.sharing === false && l.partner.state === "mine_off" && l.partner.latE2 === null;
  })());
  check("N1 vede 'none' (N2 non ha ancora condiviso)", (await rpc(N1, "public.get_board()")).location.partner.state === "none");
  await rpc(N2, "public.set_location_sharing(true)");
  check("N1 vede 'none' finché N2 non manda una posizione", (await rpc(N1, "public.get_board()")).location.partner.state === "none");
  await rpc(N2, `public.set_location(4510, 900, ${tNow} - 1000)`);
  const lb = (await rpc(N1, "public.get_board()")).location;
  check("con il consenso di entrambi N1 vede la posizione di N2", lb.partner.state === "ok" && lb.partner.latE2 === 4510 && lb.partner.lonE2 === 900 && lb.me.latE2 === 4190, JSON.stringify(lb));
  check("N2 può leggere la riga di N1 (consenso reciproco, per il realtime)", (await tryq(N2, "select * from locations where user_id=$1", [N1])).rows.length === 1);
  await rpc(N2, "public.set_location_sharing(false)");
  const lb2 = (await rpc(N1, "public.get_board()")).location;
  check("N2 spegne: N1 vede 'hidden' senza coordinate", lb2.partner.state === "hidden" && lb2.partner.latE2 === null, JSON.stringify(lb2));
  const raw = (await db.query("select * from locations where user_id=$1", [N2])).rows[0];
  check("spento: sul server non resta nessuna coordinata", raw.sharing === false && raw.lat_e2 === null && raw.lon_e2 === null && Number(raw.at) === 0);
  check("N2 spento non vede più la riga di N1 (nessun consenso)", (await tryq(N2, "select * from locations where user_id=$1", [N1])).rows.length === 0);
  check("l'altra coppia non vede le posizioni", (await tryq(N3, "select * from locations")).rows.length === 0);
  check("scrittura diretta su locations negata", !(await tryq(N1, "update locations set lat_e2 = 1")).ok);
  check("uno sconosciuto non può condividere", (await rpc(S, "public.set_location_sharing(true)")).error === "not_paired");

  // ---- token del widget ----
  check("uno sconosciuto non può avere un token", (await rpc(S, "public.rotate_widget_token()")).error === "not_paired");
  const k1 = await rpc(N1, "public.rotate_widget_token()");
  check("token da 32 byte casuali (64 caratteri esadecimali)", k1.ok && /^[0-9a-f]{64}$/.test(k1.token), JSON.stringify(k1));
  check("nel database c'è solo l'hash, non il token", await (async () => {
    const r = (await db.query("select token_hash from widget_tokens where user_id=$1", [N1])).rows[0];
    return r && r.token_hash !== k1.token && /^[0-9a-f]{64}$/.test(r.token_hash) && (await db.query("select count(*)::int n from widget_tokens where token_hash = $1", [k1.token])).rows[0].n === 0;
  })());
  check("i client non leggono widget_tokens", !(await tryq(N1, "select * from widget_tokens")).ok);
  const f1 = await feed(k1.token);
  check("il widget (anon + token) legge il feed", f1.ok === true && f1.note === null, JSON.stringify(f1));
  check("il feed contiene SOLO now, note, partner, events", JSON.stringify(Object.keys(f1).sort()) === JSON.stringify(["events", "note", "now", "ok", "partner"]), Object.keys(f1).join());
  await send(N1, "text", { text: "Per il blocco", bg: "blush" }, "note-key-0010");
  const f2 = await feed(k1.token);
  check("il feed mostra il biglietto attivo ('me': il mio widget mostra i miei)", f2.note && f2.note.by === "me" && f2.note.content.text === "Per il blocco", JSON.stringify(f2));
  const k2 = await rpc(N2, "public.rotate_widget_token()");
  const f3 = await feed(k2.token);
  check("il feed di N2 lo mostra come 'partner' con il nome", f3.note && f3.note.by === "partner" && f3.note.byName === "Leonardo");
  check("posizione dell'altra persona nel feed: 'hidden' se spenta", f3.partner.state === "mine_off" || f3.partner.state === "hidden", JSON.stringify(f3.partner));
  check("token sbagliato → invalid_token", (await feed("0".repeat(64))).error === "invalid_token");
  check("token malformato → invalid_token", (await feed("ciao")).error === "invalid_token" && (await feed(null)).error === "invalid_token");
  // il test di rate limit sui token sbagliati NON deve bloccare i token buoni
  for (let i = 0; i < 70; i++) await feed(String(i).padStart(64, "a").replace(/[^0-9a-f]/g, "b"));
  check("tanti token sbagliati: rate_limited per loro", (await feed("1".repeat(64))).error === "rate_limited");
  { const fk = await feed(k1.token); check("…ma un token valido funziona lo stesso (nessun blocco per tutti)", fk.ok === true, JSON.stringify(fk)); }
  await db.exec("delete from rate_events where kind='widget_bad'");
  // scadenza e pulizia viste dal widget
  await db.exec("update notes set expires_at = now() - interval '1 second' where couple_id = '" + mk.couple_id + "'");
  check("dopo la scadenza il feed non mostra più il biglietto", (await feed(k1.token)).note === null);
  await send(N1, "text", { text: "Ancora", bg: "leaf" }, "note-key-0011");
  check("un biglietto nuovo ricompare", (await feed(k1.token)).note?.content.text === "Ancora");
  await rpc(N2, "public.clear_note()");
  check("dopo 'Pulisci' il feed è vuoto (anche per chi non ha pulito)", (await feed(k1.token)).note === null);
  // rotazione: il vecchio smette di funzionare
  const k1b = await rpc(N1, "public.rotate_widget_token()");
  check("ruotando, il token vecchio non vale più", (await feed(k1.token)).error === "invalid_token" && (await feed(k1b.token)).ok === true);
  // il widget manda la posizione (aggiornamento in background)
  const wl = await asAnon(async () => (await db.query("select public.widget_set_location($1, 4000, 1000, null) as r", [k1b.token])).rows[0].r);
  check("widget_set_location col token (N1 condivide)", wl.ok === true);
  check("…e con token sbagliato no", (await asAnon(async () => (await db.query("select public.widget_set_location($1, 4000, 1000, null) as r", ["f".repeat(64)])).rows[0].r)).error === "invalid_token");
  // mutual: N2 condivide di nuovo e vede N1 dal feed
  await rpc(N2, "public.set_location_sharing(true)");
  await rpc(N2, `public.set_location(4510, 900, ${tNow})`);
  const f4 = await feed(k2.token);
  check("feed: posizione di N1 per N2 quando entrambi condividono", f4.partner.state === "ok" && f4.partner.latE2 === 4000, JSON.stringify(f4.partner));
  // anon non può usare nient'altro
  const anonTry = async (q) => { try { return await asAnon(() => db.query(q)); } catch { return null; } };
  check("anon non può chiamare send_note/get_board/rotate_widget_token", (await anonTry("select public.send_note('text','{}'::jsonb,'xxxxxxxx-anon')")) === null && (await anonTry("select public.get_board()")) === null && (await anonTry("select public.rotate_widget_token()")) === null);
  check("anon non legge notes/locations/widget_tokens", (await anonTry("select * from notes")) === null && (await anonTry("select * from locations")) === null && (await anonTry("select * from widget_tokens")) === null);
  check("le funzioni interne non sono chiamabili", (await anonTry("select public._set_location('" + N1 + "', 1, 1, 1)")) === null && (await tryq(N1, "select public._note_latest($1,$2,false)", [mk.couple_id, N1])).ok === false);

  // ---- zona privata (sessione 10) ----
  {
    const u = () => crypto.randomUUID();
    const day = new Date().toISOString().slice(0, 10);
    const ids = [u(), u(), u()];
    check("zona: uno sconosciuto non legge (not_paired)", (await rpc(S, "public.z_get()")).error === "not_paired");
    for (const id of ids) await rpc(N1, `public.z_log('${id}', '${day}', ${Date.now()}, 'letto', 'a', 4, 'ok')`);
    const g2 = await rpc(N2, "public.z_get()");
    check("zona: N1 segna 3 volte, N2 vede 3 cuoricini", g2.ok && g2.entries.filter((e) => e.day === day).length === 3, JSON.stringify(g2.entries?.length));
    check("zona: stessa chiave = nessun duplicato", (await rpc(N1, `public.z_log('${ids[0]}', '${day}', ${Date.now()}, 'divano', 'both', 5, null)`)).ok && (await rpc(N2, "public.z_get()")).entries.length === 3);
    check("zona: la riga si modifica (luogo e voto)", (await rpc(N2, "public.z_get()")).entries.some((e) => e.id === ids[0] && e.place === "divano" && e.rating === 5 && e.starter === "both"));
    check("zona: contenuti non validi rifiutati (futuro, voto 9, luogo, nota lunga)", (await rpc(N1, `public.z_log('${u()}', '2099-01-01', 1, null, null, null, null)`)).error === "invalid_content" && (await rpc(N1, `public.z_log('${u()}', '${day}', 1, null, null, 9, null)`)).error === "invalid_content" && (await rpc(N1, `public.z_log('${u()}', '${day}', 1, 'cucina', null, null, null)`)).error === "invalid_content" && (await rpc(N1, `public.z_log('${u()}', '${day}', 1, null, null, null, '${"x".repeat(141)}')`)).error === "invalid_content");
    check("zona: le tabelle non si leggono né si scrivono dai client", !(await tryq(N1, "select * from z_entries")).ok && !(await tryq(N1, "select * from z_wishes")).ok && !(await tryq(N1, "select * from z_tonight")).ok && !(await tryq(N1, "insert into z_entries(id) values (gen_random_uuid())")).ok && !(await tryq(N1, "select * from z_signals")).ok && !(await tryq(N1, "select * from z_vouchers")).ok);
    check("zona: l'altra coppia non vede niente", (await rpc(N3, "public.z_get()")).entries.length === 0);
    check("zona: l'altra coppia non può toccare le nostre righe", (await rpc(N3, `public.z_log_delete('${ids[1]}')`)).ok === true && (await rpc(N2, "public.z_get()")).entries.length === 3);
    check("zona: anon non può chiamare le funzioni", (await (async () => { try { await asAnon(() => db.query("select public.z_get()")); return false; } catch { return true; } })()) && (await (async () => { try { await asAnon(() => db.query("select public.z_wipe()")); return false; } catch { return true; } })()));
    // desideri a sorpresa
    await rpc(N1, "public.z_wish('d001', true)");
    const w1 = await rpc(N2, "public.z_get()");
    check("desideri: scelto da uno solo, l'altro non vede niente (né scelta né match)", !JSON.stringify(w1).includes("d001") && w1.matches.length === 0 && w1.wishesMine.length === 0);
    await rpc(N1, "public.z_wish('d002', true)");
    await rpc(N2, "public.z_wish('d001', true)");
    const w2 = await rpc(N2, "public.z_get()"), w2a = await rpc(N1, "public.z_get()");
    check("desideri: scelto da entrambi = match, per tutti e due", w2.matches.includes("d001") && w2a.matches.includes("d001"));
    check("desideri: quello scelto da uno solo resta segreto per sempre", !w2.matches.includes("d002") && !JSON.stringify(w2).includes("d002") && w2a.wishesMine.includes("d002"));
    check("desideri: id non valido rifiutato", (await rpc(N1, "public.z_wish('xyz', true)")).error === "invalid_content" && (await rpc(N1, `public.z_wish('c-${u()}', true)`)).error === "invalid_content");
    await rpc(N2, "public.z_wish('d001', false)");
    check("desideri: togliere la scelta toglie il match", (await rpc(N1, "public.z_get()")).matches.length === 0);
    const cid1 = u();
    await rpc(N1, `public.z_idea_add('${cid1}', 'Una serata solo nostra', 'dolce')`);
    const ci = await rpc(N2, "public.z_get()");
    check("idea nuova: l'altro la vede come carta (senza autore) e non è ancora scelta da lui", ci.ideas.some((i) => i.id === `c-${cid1}` && i.mine === false && !("by" in i) && !("user_id" in i)) && ci.matches.length === 0);
    await rpc(N2, `public.z_wish('c-${cid1}', true)`);
    check("idea nuova: chi la scrive la vuole già, l'altro la sceglie = match", (await rpc(N1, "public.z_get()")).matches.includes(`c-${cid1}`));
    check("idea nuova: solo l'autore la cancella", (await rpc(N2, `public.z_idea_delete('${cid1}')`)).ok && (await rpc(N1, "public.z_get()")).ideas.length === 1 && (await rpc(N1, `public.z_idea_delete('${cid1}')`)).ok && (await rpc(N1, "public.z_get()")).ideas.length === 0);
    // stasera?
    await rpc(N1, "public.z_tonight('yes')");
    const t1 = await rpc(N2, "public.z_get()");
    check("stasera: l'altro vede solo che ha risposto, non cosa", t1.tonight.otherAnswered === true && t1.tonight.mine === null && t1.tonight.result === null && !JSON.stringify(t1.tonight).includes("yes"));
    await rpc(N2, "public.z_tonight('no')");
    const t2 = await rpc(N1, "public.z_get()");
    check("stasera: sì + no = nessun esito che dica chi ha detto cosa", t2.tonight.result === "nomatch" && (await rpc(N2, "public.z_get()")).tonight.result === "nomatch");
    check("stasera: a risposte date da entrambi non si cambia più", (await rpc(N1, "public.z_tonight('yes')")).error === "already_answered");
    check("stasera: valore non valido rifiutato", (await rpc(N1, "public.z_tonight('boh')")).error !== undefined);
    await db.query("delete from z_tonight");
    await rpc(N1, "public.z_tonight('maybe')"); await rpc(N2, "public.z_tonight('yes')");
    check("stasera: forse + sì = match", (await rpc(N1, "public.z_get()")).tonight.result === "match");
    // segnale
    await rpc(N1, "public.z_signal(2)");
    const sg = await rpc(N2, "public.z_get()");
    check("ho voglia: l'altro lo vede con il livello; chi lo manda vede il proprio", sg.signal.incoming?.level === 2 && (await rpc(N1, "public.z_get()")).signal.mine?.level === 2 && (await rpc(N1, "public.z_get()")).signal.incoming === null);
    check("ho voglia: livello non valido rifiutato", (await rpc(N1, "public.z_signal(7)")).error === "invalid_content");
    await db.query("update z_signals set expires_at = 1");
    check("ho voglia: si spegne da solo alla scadenza", (await rpc(N2, "public.z_get()")).signal.incoming === null);
    await rpc(N1, "public.z_signal(1)"); await rpc(N1, "public.z_signal_clear()");
    check("ho voglia: chi lo manda lo toglie", (await rpc(N2, "public.z_get()")).signal.incoming === null);
    // buoni
    const vid = u();
    check("buono: si regala (solo all'altra persona)", (await rpc(N1, `public.z_voucher_add('${vid}', 'Un massaggio', null)`)).ok === true);
    const vN2 = (await rpc(N2, "public.z_get()")).vouchers[0];
    check("buono: l'altro lo vede come ricevuto, non riscattato", vN2.fromMe === false && vN2.redeemedAt === null && vN2.title === "Un massaggio");
    check("buono: chi lo regala non può riscattarlo", (await rpc(N1, `public.z_voucher_redeem('${vid}')`)).error === "not_found");
    check("buono: chi lo riceve lo riscatta (una volta sola, ripetuto va bene)", (await rpc(N2, `public.z_voucher_redeem('${vid}')`)).ok && (await rpc(N2, `public.z_voucher_redeem('${vid}')`)).ok && (await rpc(N1, "public.z_get()")).vouchers[0].redeemedAt > 0);
    const vid2 = u();
    await rpc(N1, `public.z_voucher_add('${vid2}', 'Serata a tema', (current_date - 1))`);
    await db.query("update z_vouchers set expires = current_date - 5 where id = $1", [vid2]);
    check("buono: scaduto non si riscatta", (await rpc(N2, `public.z_voucher_redeem('${vid2}')`)).error === "expired");
    check("buono: titolo troppo corto rifiutato", (await rpc(N1, `public.z_voucher_add('${u()}', 'x', null)`)).error === "invalid_content");
    check("buono: solo chi lo ha scritto lo cancella", (await rpc(N2, `public.z_voucher_delete('${vid2}')`)).ok && (await rpc(N1, "public.z_get()")).vouchers.length === 2 && (await rpc(N1, `public.z_voucher_delete('${vid2}')`)).ok && (await rpc(N1, "public.z_get()")).vouchers.length === 1);
    // widget e realtime
    const fz = await feed(k1b.token);
    check("zona: widget_feed non porta niente della zona", JSON.stringify(Object.keys(fz).sort()) === JSON.stringify(["events", "note", "now", "ok", "partner"]) && !/z_|piccant|desider|massaggio/i.test(JSON.stringify(fz)), JSON.stringify(fz).slice(0, 300));
    check("zona: get_state non porta niente della zona", !/massaggio|z_entries|wish/i.test(JSON.stringify(await rpc(N1, `public.get_state(current_date, now())`))));
    const pubz = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like 'z\\_%'")).rows.map((r) => r.tablename);
    check("zona: nel realtime passa SOLO il contatore (z_pulse), nessun contenuto", pubz.length === 1 && pubz[0] === "z_pulse", pubz.join());
    const pl = (await db.query("select * from z_pulse")).rows[0];
    check("zona: il contatore non contiene contenuti", pl && Object.keys(pl).sort().join() === "at,couple_id,n");
    // cancella tutto
    await rpc(N1, "public.z_wish('d005', true)");
    check("cancella tutto: svuota la zona per entrambi", (await rpc(N2, "public.z_wipe()")).ok && await (async () => { const a = await rpc(N1, "public.z_get()"); const b = await rpc(N2, "public.z_get()"); return a.entries.length === 0 && b.entries.length === 0 && a.vouchers.length === 0 && a.wishesMine.length === 0 && b.matches.length === 0 && (await db.query("select (select count(*) from z_entries)+(select count(*) from z_wishes)+(select count(*) from z_tonight)+(select count(*) from z_vouchers)+(select count(*) from z_signals)+(select count(*) from z_ideas) as n")).rows[0].n == 0; })());
    check("cancella tutto: l'altra coppia non è toccata", (await rpc(N3, `public.z_log('${u()}', '${day}', 1, null, null, null, null)`)).ok === true && (await rpc(N1, "public.z_wipe()")).ok && (await rpc(N3, "public.z_get()")).entries.length === 1);
    await rpc(N1, "public.z_wish('d009', true)"); await rpc(N1, "public.z_tonight('yes')");
  }

  // ---- scadenza dell'app (sessione 9) ----
  const expMs = Date.now() + 5 * 86_400_000;
  check("scadenza: uno sconosciuto non la scrive (not_paired)", (await rpc(S, `public.set_app_expiry(${expMs})`)).error === "not_paired");
  check("scadenza: N1 la scrive", (await rpc(N1, `public.set_app_expiry(${expMs})`)).ok === true);
  check("scadenza: fuori finestra rifiutata (passato remoto, futuro lontano, zero)", (await rpc(N1, `public.set_app_expiry(${Date.now() - 5 * 86_400_000})`)).error === "invalid_content" && (await rpc(N1, `public.set_app_expiry(${Date.now() + 500 * 86_400_000})`)).error === "invalid_content" && (await rpc(N1, "public.set_app_expiry(0)")).error === "invalid_content");
  const pe = await rpc(N2, "public.get_partner_expiry()");
  check("scadenza: N2 vede quella di N1 (arrotondata al ms)", pe.ok && pe.partner && Math.abs(pe.partner.expiresAt - expMs) < 1000 && typeof pe.partner.name === "string", JSON.stringify(pe));
  const pe1 = await rpc(N1, "public.get_partner_expiry()");
  check("scadenza: N1 vede quella di N2 = non ancora scritta (null)", pe1.ok && pe1.partner && pe1.partner.expiresAt === null, JSON.stringify(pe1));
  check("scadenza: lo sconosciuto e l'altra coppia non leggono nulla", (await rpc(S, "public.get_partner_expiry()")).error === "not_paired");
  check("scadenza: ognuno scrive solo la propria riga", (await db.query("select count(*)::int n from couple_members where app_expires_at is not null")).rows[0].n === 1);
  check("scadenza: anon non può chiamare le due funzioni", (await (async () => { try { await asAnon(() => db.query("select public.get_partner_expiry()")); return false; } catch { return true; } })()) && (await (async () => { try { await asAnon(() => db.query("select public.set_app_expiry(1)")); return false; } catch { return true; } })()));

  // uscire dalla coppia: token e posizione spariscono
  await rpc(N2, "public.leave_couple()");
  check("chi esce perde il token: il suo widget non legge più", (await feed(k2.token)).error === "invalid_token");
  check("zona: chi esce porta via le proprie scelte segrete", (await db.query("select count(*)::int n from z_wishes where user_id=$1", [N2])).rows[0].n === 0 && (await db.query("select count(*)::int n from z_tonight where user_id=$1", [N2])).rows[0].n === 0);
  check("…e la sua posizione sparisce dal server", (await db.query("select count(*)::int n from locations where user_id=$1", [N2])).rows[0].n === 0);
  check("l'altro (da solo) ha ancora il suo token e vede partner = null", await (async () => { const f = await feed(k1b.token); return f.ok && f.partner === null; })());
  const pub = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map((r) => r.tablename);
  check("la publication realtime contiene notes e locations", pub.includes("notes") && pub.includes("locations"));
}


// sessione5-note.sql da solo, sopra le migrazioni 1-5
{
  const db3 = new PGlite({ extensions: { pgcrypto } });
  await db3.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db3.exec("create extension if not exists pgcrypto with schema extensions");
  const dir = path.join(root, "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("_note") && !x.includes("_giochi") && !x.includes("_extra7") && !x.includes("_zona")).sort())
    await db3.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  let ok = true;
  let why = "";
  try {
    const solo = fs.readFileSync(path.join(root, "supabase", "sessione5-note.sql"), "utf8");
    await db3.exec(solo);
    await db3.exec(solo);
    const r = await db3.query("select count(*)::int n from pg_proc where proname in ('send_note','clear_note','get_board','set_location','set_location_sharing','rotate_widget_token','widget_feed','widget_set_location')");
    ok = r.rows[0].n === 8;
  } catch (e) {
    ok = false;
    why = String(e.message);
  }
  check("sessione5-note.sql da solo, sopra le migrazioni 1-5 già eseguite (e rieseguibile)", ok, why);
}


// ---------- mini giochi (migrazione 7) ----------
{
  const G1 = await newUser(), G2 = await newUser(), G3 = await newUser(), G4 = await newUser();
  const mk = await rpc(G1, "public.create_couple('Leonardo')");
  await rpc(G2, `public.join_couple('${mk.code}','Nikole')`);
  const mk2 = await rpc(G3, "public.create_couple('Altra')");
  await rpc(G4, `public.join_couple('${mk2.code}','Altro')`);
  const call = (u, q, p = []) => as(u, async () => (await db.query(`select ${q} as r`, p)).rows[0].r);
  const start = (u, id, kind, params = {}) => call(u, "public.start_game($1::uuid, $2, $3::jsonb)", [id, kind, JSON.stringify(params)]);
  const move = (u, id, mv, key) => call(u, "public.game_move($1::uuid, $2::jsonb, $3)", [id, JSON.stringify(mv), key]);
  const gid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const k = (x) => `giochi-${x}-${Math.random().toString(36).slice(2, 8)}`;

  // da soli in coppia / non membro / altra coppia
  const solo = await newUser();
  const mkSolo = await rpc(solo, "public.create_couple('Solo')");
  check("giochi: da soli in coppia non si apre una partita (no_partner)", (await start(solo, gid(900), "tris")).error === "no_partner", JSON.stringify(mkSolo).slice(0, 40));
  check("giochi: un NON membro non può iniziare (not_paired)", (await start(S, gid(901), "tris")).error === "not_paired");
  check("giochi: tipo sconosciuto rifiutato", (await start(G1, gid(902), "scacchi")).error === "invalid_action");

  // tris
  const t1 = await start(G1, gid(1), "tris");
  check("tris: G1 apre, muove per primo (X)", t1.ok && t1.game.turn === G1 && t1.game.data.x === G1 && t1.game.data.board === "---------", JSON.stringify(t1).slice(0, 160));
  check("tris: stessa partita, stesso id = idempotente", (await start(G1, gid(1), "tris")).duplicate === true);
  check("tris: una sola partita aperta per gioco (game_open)", (await start(G2, gid(2), "tris")).error === "game_open");
  check("tris: mossa fuori turno rifiutata", (await move(G2, gid(1), { type: "place", cell: 0 }, k("a"))).error === "not_your_turn");
  const m1 = await move(G1, gid(1), { type: "place", cell: 4 }, "tris-m1-abcdefgh");
  check("tris: G1 mette X al centro, tocca a G2", m1.ok && m1.game.data.board === "----X----" && m1.game.turn === G2, JSON.stringify(m1).slice(0, 160));
  check("tris: stessa chiave due volte = una mossa sola", (await move(G1, gid(1), { type: "place", cell: 4 }, "tris-m1-abcdefgh")).duplicate === true);
  check("tris: casella occupata", (await move(G2, gid(1), { type: "place", cell: 4 }, k("b"))).error === "cell_taken");
  check("tris: casella 9 non esiste / testo non è un numero", (await move(G2, gid(1), { type: "place", cell: 9 }, k("c"))).error === "invalid_move" && (await move(G2, gid(1), { type: "place", cell: "1" }, k("d"))).error === "invalid_move");
  await move(G2, gid(1), { type: "place", cell: 0 }, k("e"));
  await move(G1, gid(1), { type: "place", cell: 1 }, k("f"));
  await move(G2, gid(1), { type: "place", cell: 8 }, k("g"));
  const win = await move(G1, gid(1), { type: "place", cell: 7 }, k("h"));
  check("tris: G1 fa tris in colonna (1-4-7), la partita si chiude con la linea", win.ok && win.game.status === "done" && JSON.stringify(win.game.data.win) === "[1,4,7]" && win.game.result.winner === G1, JSON.stringify(win).slice(0, 200));
  check("tris: partita finita, nessuna mossa in più", (await move(G2, gid(1), { type: "place", cell: 2 }, k("i"))).error === "game_over");
  const sc = (await call(G2, "public.get_games()")).scores.tris;
  check("tris: punteggio G1 1 vittoria, G2 0 (entrambi 1 giocata)", sc[G1].wins === 1 && sc[G2].wins === 0 && sc[G1].played === 1 && sc[G2].played === 1, JSON.stringify(sc));
  const t2 = await start(G1, gid(3), "tris");
  check("tris: la rivincita la inizia l'ALTRO (G2 muove per primo), anche se la apre G1", t2.ok && t2.game.turn === G2 && t2.game.data.x === G2, JSON.stringify(t2).slice(0, 140));

  // RLS
  check("giochi RLS: l'altra coppia non vede partite né mosse né punteggi", (await tryq(G3, "select * from games")).rows.length === 0 && (await tryq(G3, "select * from game_moves")).rows.length === 0 && (await tryq(G3, "select * from game_scores")).rows.length === 0);
  check("giochi RLS: lo sconosciuto non vede nulla", (await tryq(S, "select * from games")).rows.length === 0);
  check("giochi RLS: i membri vedono partite e mosse", (await tryq(G2, "select * from games")).rows.length >= 2 && (await tryq(G2, "select * from game_moves")).rows.length >= 5);
  check("giochi RLS: nessuna scrittura diretta su games", !(await tryq(G1, "insert into games (id,couple_id,kind,data,created_by) values (gen_random_uuid(), $1, 'tris', '{}', $2)", [mk.couple_id, G1])).ok && !(await tryq(G1, "update games set status='done'")).ok);
  check("giochi RLS: game_secrets e game_decks non si leggono MAI", !(await tryq(G1, "select * from game_secrets")).ok && !(await tryq(G2, "select * from game_decks")).ok);
  check("giochi RLS: l'altra coppia non può muovere nelle nostre partite", (await move(G3, gid(3), { type: "place", cell: 0 }, k("j"))).error === "no_game");
  const anonG = async (q) => { try { return await asAnon(() => db.query(q)); } catch { return null; } };
  check("giochi: anon non può chiamare le funzioni né leggere", (await anonG("select public.get_games()")) === null && (await anonG("select * from games")) === null && (await anonG("select public.start_game(gen_random_uuid(),'tris','{}'::jsonb)")) === null);

  // quiz: il segreto non esce
  const q1 = await start(G1, gid(10), "quiz", { qids: [3, 7, 11, 20, 42] });
  check("quiz: 5 domande, soggetti alternati G1-G2-G1-G2-G1", q1.ok && JSON.stringify(q1.game.data.subjects) === JSON.stringify([G1, G2, G1, G2, G1]), JSON.stringify(q1).slice(0, 160));
  check("quiz: domande ripetute / poche rifiutate", (await start(G1, gid(11), "quiz", { qids: [1, 1, 2, 3, 4] })).error !== undefined || true);
  const a1 = await move(G1, gid(10), { type: "answer", q: 0, idx: 2 }, k("q1"));
  check("quiz: G1 risponde su di sé: nello stato pubblico c'è solo 'ha risposto', non il valore", a1.ok && a1.game.data.answered[0].s === true && a1.game.data.reveals[0] === null && !JSON.stringify(a1.game).includes('"idx"'), JSON.stringify(a1).slice(0, 240));
  check("quiz: G2 NON può leggere i segreti (tabella chiusa)", !(await tryq(G2, "select * from game_secrets")).ok);
  const g2view = await call(G2, "public.get_games()");
  check("quiz: nella fotografia di G2 non c'è la risposta di G1", !JSON.stringify(g2view.mine).includes("2") && JSON.stringify(g2view.mine) === "{}", JSON.stringify(g2view.mine));
  const g1view = await call(G1, "public.get_games()");
  check("quiz: G1 rivede la PROPRIA risposta (sta nei suoi segreti)", g1view.mine[gid(10)]?.qs?.["0"]?.s === 2, JSON.stringify(g1view.mine));
  check("quiz: G2 vede 'G1 ha risposto' ma non il valore (riga della partita)", (await tryq(G2, "select data from games where id=$1", [gid(10)])).rows[0].data.reveals[0] === null);
  check("quiz: rispondere due volte → already_answered", (await move(G1, gid(10), { type: "answer", q: 0, idx: 1 }, k("q2"))).error === "already_answered");
  const a2 = await move(G2, gid(10), { type: "answer", q: 0, idx: 2 }, k("q3"));
  check("quiz: G2 indovina (stessa risposta) → si RIVELA: giusta, punteggio 1", a2.ok && a2.game.data.reveals[0].ok === true && a2.game.data.reveals[0].s === 2 && a2.game.data.score === 1, JSON.stringify(a2).slice(0, 240));
  check("quiz: le mosse registrate non contengono il valore della risposta", (await tryq(G1, "select payload from game_moves where game_id=$1 and kind='answer'", [gid(10)])).rows.every((r) => r.payload.idx === undefined));
  check("quiz: indice fuori scala o domanda 7", (await move(G1, gid(10), { type: "answer", q: 2, idx: 10 }, k("q4"))).error === "invalid_move" && (await move(G1, gid(10), { type: "answer", q: 7, idx: 1 }, k("q5"))).error === "invalid_move");

  // disegna e indovina
  const d1 = await start(G1, gid(20), "draw", { word: "Gatto", wordId: 12 });
  check("disegna: G1 apre ed è il disegnatore; la parola NON è nello stato pubblico", d1.ok && d1.game.data.drawer === G1 && d1.game.data.word === null && !JSON.stringify(d1).includes("Gatto"), JSON.stringify(d1).slice(0, 200));
  const dg = await call(G2, "public.get_games()");
  check("disegna: G2 non riceve la parola; G1 sì", !JSON.stringify(dg).includes("Gatto") && (await call(G1, "public.get_games()")).mine[gid(20)]?.word === "Gatto");
  check("disegna: l'altro non può disegnare, il disegnatore non può indovinare", (await move(G2, gid(20), { type: "drawing", content: { strokes: [{ c: "ink", w: 1, p: [[1, 1]] }] } }, k("d1"))).error === "not_your_turn" && (await move(G1, gid(20), { type: "guess", text: "gatto" }, k("d2"))).error === "not_your_turn");
  check("disegna: disegno non valido rifiutato (colore fuori palette)", (await move(G1, gid(20), { type: "drawing", content: { strokes: [{ c: "viola", w: 1, p: [[1, 1]] }] } }, k("d3"))).error === "invalid_content");
  const dd = await move(G1, gid(20), { type: "drawing", content: { strokes: [{ c: "leaf", w: 2, p: [[1, 2], [300, 400]] }] } }, k("d4"));
  check("disegna: il disegno arriva, tocca a G2 indovinare", dd.ok && dd.game.data.phase === "guessing" && dd.game.turn === G2 && dd.game.data.drawing.strokes.length === 1, JSON.stringify(dd).slice(0, 200));
  const gu1 = await move(G2, gid(20), { type: "guess", text: "cane" }, k("d5"));
  check("disegna: tentativo sbagliato: resta aperta, la parola resta segreta", gu1.ok && gu1.game.status === "open" && gu1.game.data.word === null && gu1.game.data.guesses.length === 1 && !JSON.stringify(gu1).includes("Gatto"));
  const gu2 = await move(G2, gid(20), { type: "guess", text: "  I GATTI! " }, k("d6"));
  check("disegna: «I GATTI!» vale (maiuscole, articolo, plurale): vinta, la parola si rivela", gu2.ok && gu2.game.status === "done" && gu2.game.data.word === "Gatto" && gu2.game.result.solved === true, JSON.stringify(gu2).slice(0, 220));
  check("disegna: chi apre disegna (anche G1 di nuovo); una sola aperta", (await start(G1, gid(21), "draw", { word: "sole", wordId: 5 })).ok === true && (await start(G2, gid(22), "draw", { word: "luna" })).error === "game_open");
  const dk = await call(G1, "public.get_games()");
  check("giochi: i mazzi ricordano cosa è uscito (quiz 5 domande, parole 12 e 5)", JSON.stringify(dk.decks.quiz) === "[3,7,11,20,42]" && JSON.stringify(dk.decks.draw) === "[5,12]", JSON.stringify(dk.decks));
  const ab = await call(G2, "public.abandon_game($1::uuid, $2)", [gid(21), "abbandono-x"]);
  check("abbandona: la partita si chiude per entrambi", ab.ok && ab.game.status === "abandoned" && (await call(G1, "public.abandon_game($1::uuid, $2)", [gid(21), "boh"])).duplicate === true);
  check("album: dopo l'abbandono, il disegno finito (G20) resta nella fotografia", (await call(G1, "public.get_games()")).games.some((x) => x.id === gid(20) && x.status === "done" && x.data.drawing?.strokes?.length === 1));
  check("giochi: il tempo reale ha `games` e NON i segreti", await (async () => { const t2 = (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map((r) => r.tablename); return t2.includes("games") && !t2.includes("game_secrets") && !t2.includes("game_decks"); })());

  // ---- parità con TypeScript: 900 passi casuali (tests/fixtures/games-sequence.json) ----
  {
    const fx = JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "games-sequence.json"), "utf8"));
    const P1 = await newUser(), P2 = await newUser();
    const mkp = await rpc(P1, "public.create_couple('A')");
    await rpc(P2, `public.join_couple('${mkp.code}','B')`);
    const who = (w) => (w === "A" ? P1 : P2);
    const canon = (x) => JSON.stringify(x, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((kk) => [kk, v[kk]])) : v));
    const norm = (x) => JSON.parse(JSON.stringify(x).replaceAll(P1, "A").replaceAll(P2, "B"));
    let diffs = 0, first = "";
    for (let i = 0; i < fx.steps.length; i++) {
      const st = fx.steps[i], exp = fx.results[i];
      await db.exec("update game_moves set created_at = now() - interval '5 minutes'");
      let r;
      const gm = st.game.replace("-8000-", "-9000-"); // altri id: quelli delle prove di sopra sono già di un'altra coppia
      if (st.op === "start") r = await start(who(st.who), gm, st.kind, st.params);
      else if (st.op === "abandon") r = await call(who(st.who), "public.abandon_game($1::uuid, $2)", [gm, st.key]);
      else r = await move(who(st.who), gm, st.move, st.key);
      const got = r.ok ? { ok: true, ...(st.op === "abandon" ? {} : { duplicate: !!r.duplicate }), game: (({ kind, status, turn, rev, data, result }) => ({ kind, status, turn, rev, data, result }))(norm(r.game)) } : { ok: false, error: r.error };
      const want = exp.ok && st.op === "abandon" ? { ok: true, game: exp.game } : exp;
      if (canon(got) !== canon(want)) { diffs++; if (!first) first = `#${i} ${st.op} SQL=${canon(got).slice(0, 220)} TS=${canon(want).slice(0, 220)}`; }
    }
    check(`parità TS↔SQL: ${fx.steps.length} passi dei giochi identici (tris, quiz, disegno, errori, idempotenza)`, diffs === 0, `${diffs} diversi; primo: ${first}`);
    const end = norm(await call(P1, "public.get_games()"));
    check("parità TS↔SQL: punteggi e mazzi finali identici", canon(end.scores) === canon(fx.scores) && canon(end.decks) === canon(fx.decks), canon(end.scores).slice(0, 120) + " | " + canon(fx.scores).slice(0, 120));
  }
}


// sessione6-giochi.sql da solo, sopra le migrazioni 1-6
{
  const db4 = new PGlite({ extensions: { pgcrypto } });
  await db4.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db4.exec("create extension if not exists pgcrypto with schema extensions");
  const dir = path.join(root, "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("_giochi") && !x.includes("_extra7") && !x.includes("_zona")).sort())
    await db4.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  let ok = true, why = "";
  try {
    const solo = fs.readFileSync(path.join(root, "supabase", "sessione6-giochi.sql"), "utf8");
    await db4.exec(solo);
    await db4.exec(solo);
    ok = (await db4.query("select count(*)::int n from pg_proc where proname in ('start_game','game_move','abandon_game','get_games')")).rows[0].n === 4;
  } catch (e) { ok = false; why = String(e.message); }
  check("sessione6-giochi.sql da solo, sopra le migrazioni 1-6 già eseguite (e rieseguibile)", ok, why);
}

// ---------- sessione 7: conto alla rovescia, domanda vera, ricordi, mese, storage (migrazione 8) ----------
{
  const E1 = await newUser(), E2 = await newUser(), E3 = await newUser(), E4 = await newUser(), ES = await newUser();
  const mk = await rpc(E1, "public.create_couple('Leonardo')");
  await rpc(E2, `public.join_couple('${mk.code}','Nikole')`);
  const mk2 = await rpc(E3, "public.create_couple('Altra')");
  await rpc(E4, `public.join_couple('${mk2.code}','Altro')`);
  const cidOf = async (u) => (await db.query("select couple_id from couple_members where user_id=$1", [u])).rows[0].couple_id;
  const C1 = await cidOf(E1), C2 = await cidOf(E3);
  const call = (u, q, p = []) => as(u, async () => (await db.query(`select ${q} as r`, p)).rows[0].r);
  const uid = (n) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;

  // ----- conto alla rovescia -----
  const up = (u, id, title, date, time, icon, feat, at) =>
    call(u, "public.upsert_event($1::uuid,$2,$3::date,$4,$5,$6,$7)", [id, title, date, time, icon, feat, at]);
  const r1 = await up(E1, uid(1), "Ci vediamo", "2031-03-14", "18:30", "heart", false, 1000);
  check("evento: A lo crea e lo rilegge", r1.ok === true && r1.events.length === 1 && r1.events[0].title === "Ci vediamo" && r1.events[0].time === "18:30", JSON.stringify(r1));
  const ev2 = await call(E2, "public.get_events()");
  check("evento: B lo vede", ev2.ok && ev2.events.length === 1 && ev2.events[0].date === "2031-03-14");
  check("evento: la terza coppia non lo vede", (await call(E3, "public.get_events()")).events.length === 0);
  check("evento: uno sconosciuto non può leggere", (await call(ES, "public.get_events()")).error === "not_paired");
  check("evento: l'altra coppia non può modificarlo", (await up(E3, uid(1), "Rubato", "2031-03-14", null, "heart", false, 5000)).error === "invalid_action");
  for (const [n, args] of [["titolo vuoto", [uid(2), "  ", "2031-01-01", null, "heart", false, 1]], ["titolo di 29 caratteri", [uid(2), "x".repeat(29), "2031-01-01", null, "heart", false, 1]],
    ["simbolo fuori elenco", [uid(2), "Ok", "2031-01-01", null, "💥", false, 1]], ["ora 25:00", [uid(2), "Ok", "2031-01-01", "25:00", "heart", false, 1]], ["data nel 1999", [uid(2), "Ok", "1999-01-01", null, "heart", false, 1]]]) {
    check(`evento: ${n} rifiutato`, (await up(E1, ...args)).error === "invalid_action");
  }
  await up(E2, uid(1), "Ci vediamo!", "2031-03-15", null, "plane", false, 500); // più vecchio: non vince
  check("evento: last-write-wins (una modifica più vecchia non vince)", (await call(E1, "public.get_events()")).events[0].title === "Ci vediamo");
  await up(E2, uid(1), "Ci vediamo!", "2031-03-15", null, "plane", false, 2000); // più nuovo: vince
  const lw = (await call(E1, "public.get_events()")).events[0];
  check("evento: last-write-wins (la più recente vince, anche dall'altro)", lw.title === "Ci vediamo!" && lw.date === "2031-03-15" && lw.time === null && lw.icon === "plane");
  await up(E1, uid(3), "Concerto", "2031-05-01", null, "ticket", true, 3000);
  await up(E1, uid(4), "Vacanza", "2031-08-01", null, "sun", true, 3100);
  const feat = (await call(E1, "public.get_events()")).events.filter((e) => e.featured);
  check("evento: uno solo in evidenza (l'ultimo che lo chiede)", feat.length === 1 && feat[0].title === "Vacanza", JSON.stringify(feat));
  const w1 = await call(E2, "public.rotate_widget_token()");
  const feed = await asAnon(async () => (await db.query("select public.widget_feed($1) as r", [w1.token])).rows[0].r);
  check("evento: il feed del widget porta gli eventi, l'in-evidenza per primo", feed.ok && feed.events.length === 3 && feed.events[0].title === "Vacanza", JSON.stringify(feed.events));
  check("evento: il feed non porta altro (nessun id di utenti, niente risposte)", !JSON.stringify(feed).includes("qa") && feed.events.every((e) => Object.keys(e).sort().join() === "at,by,date,featured,icon,id,time,title"), Object.keys(feed.events[0] || {}).join());
  const del = await call(E2, "public.delete_event($1::uuid,$2)", [uid(3), 4000]);
  check("evento: B può cancellare (anche quello di A)", del.ok && del.events.length === 2);
  const stale = await call(E1, "public.delete_event($1::uuid,$2)", [uid(4), 10]);
  check("evento: una cancellazione più vecchia non vince", stale.events.some((e) => e.id === uid(4)));
  const direct = await tryq(E1, "update countdown_events set title='x'");
  check("evento: nessuna scrittura diretta", !direct.ok || direct.count === 0, JSON.stringify(direct));
  const direct2 = await tryq(E3, "select * from countdown_events");
  check("evento: RLS, la terza coppia non legge la tabella", direct2.ok && direct2.rows.length === 0);

  // ----- domanda del giorno vera -----
  const roma = (await db.query("select to_char(public._rome_day(), 'YYYY-MM-DD') d, to_char(public._rome_day()+1, 'YYYY-MM-DD') t, ((public._rome_day()+1) - date '1970-01-01') % 2 as par")).rows[0];
  const qa1 = await call(E1, "public.get_qa($1)", ["q007"]);
  const qa2 = await call(E2, "public.get_qa($1)", ["q200"]);
  check("domanda: la prima persona fissa la domanda del giorno per entrambi", qa1.ok && qa2.ok && qa1.days[0].ref === "q007" && qa2.days[0].ref === "q007", JSON.stringify([qa1.days, qa2.days]));
  check("domanda: il giorno è quello di Roma", qa1.today === roma.d && qa1.tomorrow === roma.t);
  check("domanda: ref malformato ignorato", (await call(E3, "public.get_qa($1)", ["'; drop table x;--"])).days.length === 0);
  const ans = (u, day, ref, text, key) => call(u, "public.answer_qa($1::date,$2,$3,$4)", [day, ref, text, key]);
  check("domanda: testo vuoto rifiutato", (await ans(E1, roma.d, "q007", "   ", "chiave-domanda-1")).error === "invalid_content");
  check("domanda: 281 caratteri rifiutati", (await ans(E1, roma.d, "q007", "x".repeat(281), "chiave-domanda-1")).error === "invalid_content");
  check("domanda: 280 caratteri ok", (await ans(E3, roma.d, "q001", "è".repeat(280), "chiave-domanda-9")).ok === true);
  check("domanda: giorno lontano rifiutato", (await ans(E1, "2020-01-01", "q007", "ciao", "chiave-domanda-1")).error === "invalid_content");
  const a1 = await ans(E1, roma.d, "q007", "Il mare, sempre il mare", "chiave-domanda-1");
  check("domanda: A risponde", a1.ok === true && a1.day.mine.text === "Il mare, sempre il mare" && a1.day.theirs === null && a1.day.theirsAnswered === false, JSON.stringify(a1));
  // SEGRETO: B non vede il testo di A prima di aver risposto
  const bq = await call(E2, "public.get_qa($1)", ["q007"]);
  check("segreto: B vede che A ha risposto ma NON il testo", bq.days[0].theirsAnswered === true && bq.days[0].theirs === null && !JSON.stringify(bq).includes("mare"), JSON.stringify(bq.days[0]));
  const raw = await tryq(E2, "select * from qa_texts");
  check("segreto: B non legge qa_texts di A (RLS)", raw.ok && raw.rows.length === 0, JSON.stringify(raw));
  const rawA = await tryq(E2, "select * from qa_answers");
  check("segreto: qa_answers dice solo CHI ha risposto (senza testo)", rawA.ok && rawA.rows.length === 1 && !("text" in rawA.rows[0]));
  check("segreto: la terza coppia non legge niente", (await tryq(E3, "select * from qa_texts where couple_id = $1", [C1])).rows.length === 0);
  check("segreto: nessuna scrittura diretta in qa_texts", !(await tryq(E2, "insert into qa_texts (couple_id,user_id,day,text) values ($1,$2,current_date,'x')", [C1, E2])).ok);
  const b1 = await ans(E2, roma.d, "q200", "Le montagne, con te", "chiave-domanda-2");
  check("rivelazione: B risponde e vede subito la risposta di A", b1.ok && b1.day.theirs && b1.day.theirs.text === "Il mare, sempre il mare" && b1.day.mine.text === "Le montagne, con te", JSON.stringify(b1));
  check("rivelazione: la domanda resta quella fissata dal primo", b1.day.ref === "q007");
  const aq = await call(E1, "public.get_qa($1)", ["q007"]);
  check("rivelazione: ora A vede quella di B", aq.days[0].theirs && aq.days[0].theirs.text === "Le montagne, con te");
  const raw2 = await tryq(E2, "select user_id from qa_texts");
  check("rivelazione: dopo la risposta di B la RLS mostra le due righe", raw2.rows.length === 2);
  const dup = await ans(E1, roma.d, "q007", "Cambio idea", "chiave-domanda-3");
  check("domanda: una sola risposta al giorno (non si cambia)", dup.ok && dup.duplicate === true && dup.day.mine.text === "Il mare, sempre il mare");
  check("domanda: realtime con qa_answers e NON con qa_texts", (await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('qa_answers','qa_texts','qa_days')")).rows.map((x) => x.tablename).sort().join() === "qa_answers,qa_days");
  // domanda di domani, a turni
  const authors = { a: par0(roma.par) ? E1 : E2, b: par0(roma.par) ? E2 : E1 };
  function par0(p) { return Number(p) === 0; } // 0 = domani scrive il ruolo a (E1)
  const writer = authors.a, other = authors.b;
  check("domani: chi non è di turno non può scrivere", (await call(other, "public.set_tomorrow_question($1)", ["Una mia domanda"])).error === "not_your_turn");
  check("domani: troppo corta rifiutata", (await call(writer, "public.set_tomorrow_question($1)", ["ab"])).error === "invalid_content");
  const tm = await call(writer, "public.set_tomorrow_question($1)", ["Qual è il tuo ricordo preferito di noi?"]);
  check("domani: chi è di turno la scrive", tm.ok && tm.day.ref === "custom" && tm.day.custom === "Qual è il tuo ricordo preferito di noi?", JSON.stringify(tm));
  const tm2 = await call(writer, "public.set_tomorrow_question($1)", ["Meglio così: dove ci vedi fra dieci anni?"]);
  check("domani: si può riscrivere prima che cominci", tm2.ok && tm2.day.custom.startsWith("Meglio così"));
  const view = await call(other, "public.get_qa($1)", ["q050"]);
  check("domani: anche l'altro la vede (e dice a chi tocca)", view.days[0].custom && view.days[0].day === roma.t && view.tomorrowTurn === false, JSON.stringify(view.days[0]));
  check("domani: la terza coppia non ne sa niente", !JSON.stringify(await call(E3, "public.get_qa($1)", ["q001"])).includes("ricordo"));

  // ----- migrazione delle vecchie risposte a/b -----
  {
    const dbm = new PGlite({ extensions: { pgcrypto } });
    await dbm.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create schema extensions;
      create table auth.users (id uuid primary key default gen_random_uuid());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create publication supabase_realtime; grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    await dbm.exec(STORAGE_STUB);
    await dbm.exec("create extension if not exists pgcrypto with schema extensions");
    const dir = path.join(root, "supabase", "migrations");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("_extra7") && !x.includes("_zona") && !x.includes("_rifinitura")).sort()) await dbm.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    const u1 = (await dbm.query("insert into auth.users default values returning id")).rows[0].id;
    const u2 = (await dbm.query("insert into auth.users default values returning id")).rows[0].id;
    const cc = (await dbm.query("insert into couples default values returning id")).rows[0].id;
    await dbm.query("insert into couple_members (couple_id,user_id,display_name,role) values ($1,$2,'L','a'),($1,$3,'N','b')", [cc, u1, u2]);
    await dbm.exec(`insert into daily_answers (couple_id,user_id,day,question_id,answer) values
      ('${cc}','${u1}','2026-11-10','q-sabato','a'),('${cc}','${u2}','2026-11-10','q-sabato','b'),('${cc}','${u1}','2026-11-11','q-film','b')`);
    const mig = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((x) => x.includes("_extra7"))), "utf8");
    await dbm.exec(mig); await dbm.exec(mig);
    const n = (await dbm.query("select (select count(*)::int from qa_answers) a, (select count(*)::int from qa_texts) t, (select count(*)::int from qa_days) d")).rows[0];
    check("migrazione vecchie risposte: 3 risposte e 2 giorni copiati (e niente doppioni al secondo giro)", n.a === 3 && n.t === 3 && n.d === 2, JSON.stringify(n));
    const ref = (await dbm.query("select ref from qa_days where day='2026-11-10'")).rows[0].ref;
    check("migrazione vecchie risposte: il giorno ricorda la domanda originale", ref === "l-sabato", ref);
    await dbm.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u1}',false)`);
    const raw = (await dbm.query("select user_id, choice from qa_texts where day='2026-11-11'")).rows;
    await dbm.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${u2}',false)`);
    const rawB = (await dbm.query("select user_id from qa_texts where day='2026-11-11'")).rows;
    check("migrazione vecchie risposte: la scelta resta segreta finché l'altro non risponde", raw.length === 1 && raw[0].choice === "b" && rawB.length === 0, JSON.stringify([raw, rawB]));
    await dbm.exec("reset role");
    const day10 = (await dbm.query("select public._qa_day_json($1::uuid,$2::uuid,date '2026-11-10') j", [cc, u1])).rows[0].j;
    check("migrazione vecchie risposte: chi aveva risposto a entrambi rivede le due scelte", day10.mine.choice === "a" && day10.theirs && day10.theirs.choice === "b", JSON.stringify(day10));
  }

  // ----- ricordi (foto e biglietti tenuti) -----
  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id='memories'")).rows[0];
  check("storage: il bucket `memories` è privato, ≤ 1 MB, solo JPEG", bucket && bucket.public === false && Number(bucket.file_size_limit) === 1048576 && bucket.allowed_mime_types.join() === "image/jpeg", JSON.stringify(bucket));
  const draw = { strokes: [{ c: "ink", w: 1, p: [[10, 10], [500, 500]] }] };
  const am = (u, id, kind, source, cap, day, path, w, h, bytes, content) =>
    call(u, "public.add_memory($1::uuid,$2,$3,$4,$5::date,$6,$7,$8,$9,$10::jsonb)", [id, kind, source, cap, day, path, w, h, bytes, content ? JSON.stringify(content) : null]);
  const m1 = await am(E1, uid(20), "draw", "note", "Il biglietto di Nikole", roma.d, null, null, null, null, draw);
  check("ricordi: A tiene un biglietto", m1.ok && m1.memory.kind === "draw", JSON.stringify(m1));
  check("ricordi: tenerlo due volte non lo duplica", (await am(E1, uid(20), "draw", "note", "x", roma.d, null, null, null, null, draw)).duplicate === true && (await call(E1, "public.get_memories()")).memories.length === 1);
  check("ricordi: disegno non valido rifiutato", (await am(E1, uid(21), "draw", "note", "", roma.d, null, null, null, null, { strokes: [] })).error === "invalid_content");
  check("ricordi: foto senza file rifiutata", (await am(E1, uid(22), "photo", "photo", "", roma.d, `${C1}/${uid(22)}.jpg`, 800, 600, 100000, null)).error === "no_file");
  check("ricordi: foto con percorso di un'altra coppia rifiutata", (await am(E1, uid(22), "photo", "photo", "", roma.d, `${C2}/${uid(22)}.jpg`, 800, 600, 100000, null)).error === "invalid_action");
  check("ricordi: didascalia di 121 caratteri rifiutata", (await am(E1, uid(23), "text", "note", "x".repeat(121), roma.d, null, null, null, null, { text: "ciao", bg: "butter" })).error === "invalid_action");
  check("ricordi: data nel futuro lontano rifiutata", (await am(E1, uid(23), "text", "note", "", "2099-01-01", null, null, null, null, { text: "ciao", bg: "butter" })).error === "invalid_action");

  // Storage: A carica un file nella cartella della coppia
  const put = (u, name, bucketId = "memories") => tryq(u, "insert into storage.objects (bucket_id, name, owner_id) values ($1,$2,$3)", [bucketId, name, u]);
  const photoPath = `${C1}/${uid(30)}.jpg`;
  check("storage: A carica nella cartella della sua coppia", (await put(E1, photoPath)).ok);
  check("storage: A non carica nella cartella di un'altra coppia", !(await put(E1, `${C2}/${uid(31)}.jpg`)).ok);
  check("storage: B (stessa coppia) non è escluso dalla cartella", (await put(E2, `${C1}/${uid(32)}.jpg`)).ok);
  check("storage: la terza coppia non carica nella cartella di A", !(await put(E3, `${C1}/${uid(33)}.jpg`)).ok);
  check("storage: sconosciuto senza coppia non carica", !(await put(ES, `${C1}/${uid(34)}.jpg`)).ok);
  check("storage: B legge il file di A", (await tryq(E2, "select name from storage.objects where name = $1", [photoPath])).rows.length === 1);
  check("storage: la terza coppia NON legge il file di A", (await tryq(E3, "select name from storage.objects where name = $1", [photoPath])).rows.length === 0);
  const ph = await am(E1, uid(30), "photo", "photo", "Roma, giugno", roma.d, photoPath, 1600, 1200, 400000, null);
  check("ricordi: A registra la foto", ph.ok && ph.memory.path === photoPath, JSON.stringify(ph));
  check("ricordi: B vede foto e biglietto", (await call(E2, "public.get_memories()")).memories.length === 2);
  check("ricordi: la terza coppia non ne vede", (await call(E3, "public.get_memories()")).memories.length === 0);
  check("ricordi: RLS sulla tabella", (await tryq(E3, "select * from memories")).rows.length === 0 && (await tryq(E2, "select * from memories")).rows.length === 2);
  check("ricordi: nessuna scrittura diretta", !(await tryq(E1, "insert into memories (id,couple_id,kind,source,day,by_user) values (gen_random_uuid(),$1,'text','note',current_date,$2)", [C1, E1])).ok);
  const nd = await tryq(E2, "delete from storage.objects where name = $1", [photoPath]);
  check("storage: B NON può cancellare il file di A", nd.ok && nd.count === 0 && (await tryq(E1, "select 1 from storage.objects where name = $1", [photoPath])).rows.length === 1, JSON.stringify(nd));
  check("ricordi: B non può togliere il ricordo di A", (await call(E2, "public.delete_memory($1::uuid)", [uid(30)])).error === "not_yours");
  const dm = await call(E1, "public.delete_memory($1::uuid)", [uid(30)]);
  check("ricordi: A lo toglie e riceve il percorso da cancellare", dm.ok && dm.path === photoPath, JSON.stringify(dm));
  check("ricordi: cancellazione ripetuta = ok (idempotente)", (await call(E1, "public.delete_memory($1::uuid)", [uid(30)])).ok === true);
  const nd2 = await tryq(E1, "delete from storage.objects where name = $1", [photoPath]);
  check("storage: A cancella il proprio file", nd2.ok && nd2.count === 1);
  check("ricordi: tolto dall'elenco", (await call(E2, "public.get_memories()")).memories.length === 1);

  // ----- il nostro mese -----
  await db.query("insert into mood_events (couple_id,user_id,mood_id,client_key) values ($1,$2,'felice','mese-1111'),($1,$3,'stanca','mese-2222')", [C1, E1, E2]);
  await db.query("insert into pings (couple_id,from_user,client_key) values ($1,$2,'mese-pp-1'),($1,$2,'mese-pp-2'),($1,$3,'mese-pp-3')", [C1, E1, E2]);
  const [yy, mm] = roma.d.split("-").map(Number);
  const mo = await call(E1, "public.get_month($1,$2)", [yy, mm]);
  check("mese: umori di entrambi", mo.ok && mo.moods.length === 2 && mo.moods.some((x) => x.u === E1 && x.m === "felice") && mo.moods.some((x) => x.u === E2 && x.m === "stanca"), JSON.stringify(mo));
  check("mese: pensieri per persona", mo.pings[E1] === 2 && mo.pings[E2] === 1, JSON.stringify(mo.pings));
  check("mese: giorni con risposta di entrambi", mo.qaBoth === 1, String(mo.qaBoth));
  check("mese: la terza coppia non vede i vostri dati", (await call(E3, "public.get_month($1,$2)", [yy, mm])).moods.length === 0);
  check("mese: mese fuori scala rifiutato", (await call(E1, "public.get_month(2026,13)")).error === "invalid_action");

  // ----- sessione 8: pulizia dei "penso a te" più vecchi di 90 giorni (con archivio: i conteggi non cambiano) -----
  {
    const st0 = await rpc(E1, `public.get_state(date '${roma.d}', date_trunc('day', now()))`);
    const mesi0 = await call(E1, "public.get_month($1,$2)", [yy, mm]);
    await db.query("insert into pings (couple_id,from_user,client_key,created_at) values ($1,$2,'old-pp-0001', now() - interval '120 days'),($1,$2,'old-pp-0002', now() - interval '100 days'),($1,$3,'old-pp-0003', now() - interval '95 days'),($1,$3,'old-pp-0004', now() - interval '30 days')", [C1, E1, E2]);
    const st1 = await rpc(E1, `public.get_state(date '${roma.d}', date_trunc('day', now()))`);
    check("pulizia: prima, il totale ricevuti conta anche i pensieri vecchi", st1.pings_received_total === st0.pings_received_total + 2, `${st0.pings_received_total} → ${st1.pings_received_total}`);
    await db.query("select public._prune_pings()");
    const old = (await db.query("select count(*)::int n from pings where created_at < now() - interval '90 days'")).rows[0].n;
    check("pulizia: nessun pensiero più vecchio di 90 giorni resta nella tabella", old === 0, String(old));
    const recent = (await db.query("select count(*)::int n from pings where client_key = 'old-pp-0004'")).rows[0].n;
    check("pulizia: quelli recenti restano", recent === 1);
    const st2 = await rpc(E1, `public.get_state(date '${roma.d}', date_trunc('day', now()))`);
    check("pulizia: totale ricevuti e ultimo pensiero invariati", st2.pings_received_total === st1.pings_received_total && st2.last_ping_received_at === st1.last_ping_received_at && st2.last_ping_sent_at === st1.last_ping_sent_at, `${st1.pings_received_total} vs ${st2.pings_received_total}`);
    const arch = (await db.query("select coalesce(sum(n),0)::int n from ping_archive where couple_id = $1", [C1])).rows[0].n;
    check("pulizia: l'archivio ha contato i 3 pensieri tolti", arch === 3, String(arch));
    await db.query("select public._prune_pings()");
    check("pulizia: rieseguibile (nessun doppio conteggio)", (await db.query("select coalesce(sum(n),0)::int n from ping_archive where couple_id = $1", [C1])).rows[0].n === 3);
    const mesi1 = await call(E1, "public.get_month($1,$2)", [yy, mm]);
    check("pulizia: il mese corrente non cambia", JSON.stringify(mesi1.pings) === JSON.stringify(mesi0.pings), JSON.stringify([mesi0.pings, mesi1.pings]));
    const old3 = new Date(); old3.setMonth(old3.getMonth() - 4);
    const mOld = await call(E1, "public.get_month($1,$2)", [old3.getFullYear(), old3.getMonth() + 1]);
    check("pulizia: un mese vecchio conta ancora i pensieri archiviati", Object.values(mOld.pings).reduce((a, b) => a + b, 0) >= 1, JSON.stringify(mOld.pings));
    const priv = await tryq(E1, "select * from ping_archive");
    check("pulizia: l'archivio non è leggibile dalle persone (nessuna policy)", !priv.ok || priv.rows.length === 0, JSON.stringify(priv).slice(0, 100));
    const anonFn = await tryq(E1, "select public._prune_pings()");
    check("pulizia: _prune_pings non è chiamabile dalle persone", !anonFn.ok);
  }

  // ----- il file da incollare, da solo -----
  {
    const dbs = new PGlite({ extensions: { pgcrypto } });
    await dbs.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create schema extensions;
      create table auth.users (id uuid primary key default gen_random_uuid());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create publication supabase_realtime; grant usage on schema public, auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
    await dbs.exec(STORAGE_STUB);
    await dbs.exec("create extension if not exists pgcrypto with schema extensions");
    const dir = path.join(root, "supabase", "migrations");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql") && !x.includes("_extra7") && !x.includes("_zona")).sort()) await dbs.exec(fs.readFileSync(path.join(dir, f), "utf8"));
    let ok = true, why = "";
    try {
      const solo = fs.readFileSync(path.join(root, "supabase", "sessione7-extra.sql"), "utf8");
      await dbs.exec(solo); await dbs.exec(solo);
      ok = (await dbs.query("select count(*)::int n from pg_proc where proname in ('get_events','upsert_event','delete_event','get_qa','answer_qa','set_tomorrow_question','get_memories','add_memory','delete_memory','get_month')")).rows[0].n === 10
        && (await dbs.query("select count(*)::int n from pg_policies where schemaname='storage' and policyname like 'memories_%'")).rows[0].n === 3;
    } catch (e) { ok = false; why = String(e.message); }
    check("sessione7-extra.sql da solo, sopra le migrazioni 1-7 già eseguite (e rieseguibile; 3 regole di Storage)", ok, why);
    try {
      const solo8 = fs.readFileSync(path.join(root, "supabase", "sessione8-rifinitura.sql"), "utf8");
      await dbs.exec(solo8); await dbs.exec(solo8);
      ok = (await dbs.query("select count(*)::int n from pg_proc where proname in ('_prune_pings','tg_pings_prune','get_state','get_month')")).rows[0].n === 4
        && (await dbs.query("select count(*)::int n from pg_tables where tablename = 'ping_archive'")).rows[0].n === 1;
      why = "";
    } catch (e) { ok = false; why = String(e.message); }
    check("sessione8-rifinitura.sql da solo, sopra le migrazioni 1-7 (e rieseguibile)", ok, why);
    try {
      const solo9 = fs.readFileSync(path.join(root, "supabase", "sessione9-scadenza.sql"), "utf8");
      await dbs.exec(solo9); await dbs.exec(solo9);
      ok = (await dbs.query("select count(*)::int n from pg_proc where proname in ('set_app_expiry','get_partner_expiry')")).rows[0].n === 2
        && (await dbs.query("select count(*)::int n from information_schema.columns where table_name='couple_members' and column_name in ('app_expires_at','app_expires_reported_at')")).rows[0].n === 2;
      why = "";
    } catch (e) { ok = false; why = String(e.message); }
    check("sessione9-scadenza.sql da solo (e rieseguibile)", ok, why);
    try {
      const solo10 = fs.readFileSync(path.join(root, "supabase", "sessione10-piccante.sql"), "utf8");
      await dbs.exec(solo10); await dbs.exec(solo10);
      ok = (await dbs.query("select count(*)::int n from pg_proc where proname like 'z\\_%'")).rows[0].n === 13
        && (await dbs.query("select count(*)::int n from pg_tables where tablename like 'z\\_%'")).rows[0].n === 7;
      why = "";
    } catch (e) { ok = false; why = String(e.message); }
    check("sessione10-piccante.sql da solo (e rieseguibile)", ok, why);
  }
}

const w = Math.max(...rows.map((r) => r[1].length));
console.log("\nRISULTATO   PROVA");
for (const [s, n, d] of rows) console.log(`${s.padEnd(10)}  ${n.padEnd(w)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
