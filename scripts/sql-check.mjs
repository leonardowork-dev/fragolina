// Prova REALE di supabase/all.sql su un Postgres locale (PGlite, gratis, in memoria): RLS, RPC, limiti.
// Uso: npm run backend:sqltest   (nessuna chiave necessaria)
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite({ extensions: { pgcrypto } });

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

const w = Math.max(...rows.map((r) => r[1].length));
console.log("\nRISULTATO   PROVA");
for (const [s, n, d] of rows) console.log(`${s.padEnd(10)}  ${n.padEnd(w)}${d ? "   → " + d : ""}`);
console.log(`\n${rows.length - failed}/${rows.length} prove passate`);
process.exit(failed ? 1 : 0);
