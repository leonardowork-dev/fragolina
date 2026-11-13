// Collaudo end-to-end del backend Supabase con DUE sessioni anonime (A e B) più un terzo e uno sconosciuto.
// Uso:  npm run backend:check
// Chiavi: SUPABASE_URL e SUPABASE_ANON_KEY (oppure EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY nel file .env.local).
// Senza chiavi: prova a secco (controlla che all.sql sia aggiornato e lo prova su un Postgres locale) ed esce con 0.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  const f = path.join(root, ".env.local");
  if (!fs.existsSync(f)) return {};
  const out = {};
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...loadEnvLocal(), ...process.env };
const URL_ = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.log("Chiavi Supabase non trovate: faccio la PROVA A SECCO.\n");
  const b = spawnSync(process.execPath, [path.join(root, "scripts", "build-sql.mjs")], {
    encoding: "utf8",
  });
  process.stdout.write(b.stdout);
  const r = spawnSync(process.execPath, [path.join(root, "scripts", "sql-check.mjs")], {
    encoding: "utf8",
  });
  const lines = r.stdout.trim().split("\n");
  console.log(lines.slice(-1)[0] ?? "(nessun output)");
  if (r.status !== 0) {
    console.log(r.stdout);
    console.error(r.stderr);
    process.exit(1);
  }
  console.log(
    "\nPer provare il backend VERO: crea il progetto Supabase seguendo MANUAL_TODO.md, poi esegui  npm run setup-env  e di nuovo  npm run backend:check.",
  );
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const mk = () =>
  createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const rows = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  rows.push([ok ? "PASS" : "FAIL", name, ok ? "" : detail]);
  if (!ok) failed++;
};
const day = new Date().toISOString().slice(0, 10);
const uuid = () => crypto.randomUUID();
const rpc = async (c, fn, args) => {
  const { data, error } = await c.rpc(fn, args);
  return error ? { ok: false, error: error.message } : data;
};

async function signIn(label) {
  const c = mk();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) {
    console.error(`\nAccesso anonimo "${label}" fallito: ${error.message}`);
    console.error(
      'Controlla in Supabase: Authentication → Sign In / Providers → "Allow anonymous sign-ins" acceso.',
    );
    process.exit(1);
  }
  return { c, id: data.user.id };
}

try {
  const A = await signIn("A");
  const B = await signIn("B");
  const C = await signIn("C (terzo)");
  const S = await signIn("S (sconosciuto)");
  check("accesso anonimo (4 sessioni)", true);

  // senza sessione
  {
    const anon = mk();
    const r = await anon.from("couples").select("*");
    check(
      "chiave pubblica SENZA sessione: niente dati",
      !!r.error || (r.data ?? []).length === 0,
      JSON.stringify(r.data),
    );
    const f = await anon.rpc("create_couple", { p_display_name: "X" });
    check(
      "chiave pubblica SENZA sessione: create_couple rifiutata",
      !!f.error,
      JSON.stringify(f.data),
    );
  }

  const created = await rpc(A.c, "create_couple", {
    p_display_name: "Alfa",
    p_start_date: "2025-02-14",
  });
  check(
    "A crea la coppia e riceve il codice",
    created.ok && /^[A-HJKMNP-Z2-9]{6}$/.test(created.code ?? ""),
    JSON.stringify(created),
  );
  if (!created.ok) throw new Error("create_couple fallita: " + JSON.stringify(created));
  const cid = created.couple_id;

  // realtime: B ascolta i ping
  let gotRealtime = false;
  const ch = B.c
    .channel("check-" + uuid())
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pings" },
      () => (gotRealtime = true),
    );
  await new Promise((res) =>
    ch.subscribe(
      (s) => (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") && res(),
    ),
  );

  const wrong = await rpc(S.c, "join_couple", { p_code: "AAAAAA", p_display_name: "Intruso" });
  check("codice sbagliato → invalid_code", wrong.error === "invalid_code", JSON.stringify(wrong));
  const joined = await rpc(B.c, "join_couple", { p_code: created.code, p_display_name: "Beta" });
  check("B entra con il codice", joined.ok === true && joined.role === "b", JSON.stringify(joined));
  const third = await rpc(C.c, "join_couple", { p_code: created.code, p_display_name: "Terzo" });
  check("il terzo NON entra (couple_full)", third.error === "couple_full", JSON.stringify(third));

  const sRead = await Promise.all(
    ["couples", "couple_members", "pings", "mood_events", "daily_answers"].map((t) =>
      S.c.from(t).select("*"),
    ),
  );
  check(
    "sconosciuto non legge nessuna tabella",
    sRead.every((r) => !r.error && (r.data ?? []).length === 0),
    JSON.stringify(sRead.map((r) => r.data?.length)),
  );
  const sPing = await S.c
    .from("pings")
    .insert({ couple_id: cid, from_user: S.id, client_key: uuid() });
  check("sconosciuto non può scrivere ping nella coppia", !!sPing.error);
  const sPatch = await S.c
    .from("couples")
    .update({ relationship_start_date: "2000-01-01" })
    .eq("id", cid)
    .select();
  check(
    "sconosciuto non può modificare la coppia",
    !!sPatch.error || (sPatch.data ?? []).length === 0,
  );
  const aMembers = await A.c.from("couple_members").select("display_name,role");
  check("A vede entrambi i membri", (aMembers.data ?? []).length === 2, JSON.stringify(aMembers));

  // ping A → B
  const key = uuid();
  const p1 = await A.c
    .from("pings")
    .upsert(
      { couple_id: cid, from_user: A.id, client_key: key },
      { onConflict: "from_user,client_key", ignoreDuplicates: true },
    );
  const p2 = await A.c
    .from("pings")
    .upsert(
      { couple_id: cid, from_user: A.id, client_key: key },
      { onConflict: "from_user,client_key", ignoreDuplicates: true },
    );
  check(
    "A manda un ping (due volte con la stessa chiave)",
    !p1.error && !p2.error,
    JSON.stringify([p1.error, p2.error]),
  );
  const bPings = await B.c.from("pings").select("id");
  check(
    "B vede UN solo ping (idempotente)",
    (bPings.data ?? []).length === 1,
    JSON.stringify(bPings.data),
  );
  for (let i = 0; i < 60 && !gotRealtime; i++) await new Promise((r) => setTimeout(r, 250));
  check(
    "realtime: B riceve il ping entro 15 s",
    gotRealtime,
    "nessun evento: controlla che Realtime sia attivo e la publication creata (all.sql)",
  );
  await B.c.removeChannel(ch);

  // umore B → A
  const m = await B.c
    .from("mood_events")
    .upsert(
      {
        couple_id: cid,
        user_id: B.id,
        mood_id: "coccole",
        client_key: uuid(),
        client_at: new Date().toISOString(),
      },
      { onConflict: "user_id,client_key", ignoreDuplicates: true },
    );
  check("B imposta l'umore", !m.error, JSON.stringify(m.error));
  const stA = await rpc(A.c, "get_state", {
    p_day: day,
    p_day_start: new Date(Date.now() - 864e5).toISOString(),
  });
  check(
    "A vede l'umore di B",
    stA.partner_mood?.mood_id === "coccole",
    JSON.stringify(stA.partner_mood),
  );
  check("A conta 1 ping inviato", stA.pings_sent_today === 1, String(stA.pings_sent_today));

  // risposta con reveal
  const aB = await B.c
    .from("daily_answers")
    .insert({ couple_id: cid, user_id: B.id, day, question_id: "q-test", answer: "b" });
  check("B risponde alla domanda", !aB.error, JSON.stringify(aB.error));
  const aSee = await A.c.from("daily_answers").select("*");
  check("A NON vede la risposta di B prima di rispondere", (aSee.data ?? []).length === 0);
  const aA = await A.c
    .from("daily_answers")
    .insert({ couple_id: cid, user_id: A.id, day, question_id: "q-test", answer: "a" });
  check("A risponde", !aA.error, JSON.stringify(aA.error));
  const aSee2 = await A.c.from("daily_answers").select("*");
  check("dopo aver risposto A vede entrambe", (aSee2.data ?? []).length === 2);

  // data di inizio LWW
  const d1 = await rpc(A.c, "set_start_date", {
    p_date: "2024-01-01",
    p_client_at: new Date(Date.now() - 36e5).toISOString(),
  });
  const d2 = await rpc(B.c, "set_start_date", { p_date: "2024-03-03" });
  check(
    "data di inizio: l'ultima scrittura vince",
    d2.start_date === "2024-03-03",
    JSON.stringify([d1, d2]),
  );
  const d3 = await rpc(A.c, "set_start_date", {
    p_date: "2020-02-02",
    p_client_at: new Date(Date.now() - 72e5).toISOString(),
  });
  check(
    "data di inizio: una scrittura più vecchia non vince",
    d3.start_date === "2024-03-03",
    JSON.stringify(d3),
  );

  // ---------- il pet condiviso (migrazione 5) ----------
  const g0 = await rpc(A.c, "get_pet", { p_limit: 12 });
  const petMissing = !!g0.error && /get_pet|PGRST202|Could not find|does not exist/i.test(String(g0.error));
  if (petMissing) {
    rows.push([
      "MANCA",
      "Pet: la migrazione del pet NON è ancora stata eseguita su questo Supabase",
      "→ MANUAL_TODO.md, Sessione 4, passo 1 (incolla supabase/sessione4-pet.sql). Poi rilancia questo comando.",
    ]);
  } else {
    check("pet: get_pet risponde (nessun pet finché nessuno tocca l'uovo)", g0.ok === true && g0.pet === null, JSON.stringify(g0));
    const act = (c, kind, item, amount, key, at = Date.now()) =>
      rpc(c, "pet_act", { p_kind: kind, p_item: item, p_amount: amount, p_day: day, p_client_key: key, p_client_at: at });
    const k = (n) => `chk-${uuid().slice(0, 8)}-${n}`;
    check("pet: cura prima della schiusa → not_hatched", (await act(A.c, "feed", "mora", 1, k("x1"))).error === "not_hatched");
    check("pet: il terzo (fuori dalla coppia) non può toccare l'uovo", !!(await act(C.c, "touch", null, 1, k("x2"))).error);

    // tempo reale: B ascolta la riga del pet
    let got = 0;
    const ch = B.c
      .channel("chk-pet-" + uuid().slice(0, 6))
      .on("postgres_changes", { event: "*", schema: "public", table: "pets", filter: `couple_id=eq.${cid}` }, () => got++);
    await new Promise((res) => ch.subscribe((st) => st === "SUBSCRIBED" && res()));
    await new Promise((r) => setTimeout(r, 800));

    const ka = k("a1");
    const t1 = await act(A.c, "touch", null, 2, ka);
    check("pet: A tocca l'uovo, non si schiude da solo", t1.ok && t1.pet.hatched_at === null, JSON.stringify(t1));
    const t1b = await act(A.c, "touch", null, 2, ka);
    check("pet: stessa chiave due volte = idempotente", t1b.ok && t1b.duplicate === true && t1b.pet.touches_a === 2, JSON.stringify(t1b));
    const t2 = await act(B.c, "touch", null, 1, k("b1"));
    check("pet: B tocca → si schiude (a due)", t2.ok && t2.pet.hatched_at !== null && t2.pet.hatched_by === B.id, JSON.stringify(t2));
    const f1 = await act(A.c, "feed", "mora", 1, k("f1"), Date.now() - 100000);
    check("pet: A dà una mora", f1.ok && f1.pet.last_item === "mora" && f1.pet.last_by === A.id, JSON.stringify(f1));
    check("pet: pausa per persona (cooldown)", (await act(A.c, "feed", "pesca", 1, k("f2"), Date.now() - 90000)).error === "cooldown");
    check("pet: l'altra persona può dare da mangiare subito", (await act(B.c, "feed", "pesca", 1, k("f3"), Date.now() - 90000)).ok === true);
    check("pet: cibo inesistente rifiutato", (await act(A.c, "feed", "pizza", 1, k("f4"))).error === "invalid_action");
    await act(A.c, "cuddle", null, 1, k("c1"));
    const gp = await rpc(B.c, "get_pet", { p_limit: 12 });
    check("pet: B legge stato, registro e 'mie ultime volte'", gp.ok && gp.pet.rev >= 5 && gp.log.length >= 4 && typeof gp.my_last.feed === "number", JSON.stringify(gp).slice(0, 200));
    check("pet: bonus 'in due' contato", gp.pet.both_days === 1 && gp.pet.care_days === 1, JSON.stringify(gp.pet));
    const nm = await rpc(B.c, "set_pet_name", { p_name: "  Fragolotta Reale Primissima ", p_client_at: Date.now() - 5000, p_client_key: k("n1") });
    check("pet: nome troncato a 16", nm.ok && nm.pet.name === "Fragolotta Reale", JSON.stringify(nm));
    const nm2 = await rpc(A.c, "set_pet_name", { p_name: "Vecchio", p_client_at: Date.now() - 60000, p_client_key: k("n2") });
    check("pet: nome, una scrittura più vecchia non vince", nm2.ok && nm2.pet.name === "Fragolotta Reale", JSON.stringify(nm2));
    const nm3 = await rpc(A.c, "set_pet_name", { p_name: "Bacca", p_client_at: Date.now(), p_client_key: k("n3") });
    check("pet: nome, una più nuova vince", nm3.ok && nm3.pet.name === "Bacca");

    // RLS: il terzo non vede nulla, nessuno scrive direttamente
    check("pet RLS: il terzo non vede la riga del pet", ((await C.c.from("pets").select("*")).data ?? []).length === 0);
    check("pet RLS: il terzo non vede il registro", ((await C.c.from("pet_actions").select("*")).data ?? []).length === 0);
    check("pet RLS: A vede la riga del pet", ((await A.c.from("pets").select("*")).data ?? []).length === 1);
    const hack = await A.c.from("pets").update({ food: 1000 }).eq("couple_id", cid).select();
    check("pet RLS: nessuna scrittura diretta (0 righe cambiate o errore)", !!hack.error || (hack.data ?? []).length === 0, JSON.stringify(hack.data));
    const hack2 = await A.c.from("pet_actions").insert({ couple_id: cid, user_id: A.id, kind: "feed", at: 1, rev: 1, client_key: "hackhackhack" });
    check("pet RLS: nessuna scrittura diretta nel registro", !!hack2.error);
    const anon = mk();
    check("pet RLS: senza sessione non si legge", ((await anon.from("pets").select("*")).data ?? []).length === 0);

    await new Promise((r) => setTimeout(r, 1500));
    check("pet realtime: B ha ricevuto le modifiche della riga del pet", got >= 2, `eventi ricevuti: ${got}`);
    await B.c.removeChannel(ch);
  }

  // pulizia: entrambi escono (la coppia si cancella da sola)
  await rpc(A.c, "leave_couple");
  await rpc(B.c, "leave_couple");
  const gone = await rpc(A.c, "get_state", { p_day: day, p_day_start: new Date().toISOString() });
  check("pulizia: A e B sono usciti, nessuna traccia", gone.paired === false);
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e));
}

const missing = rows.filter((r) => r[0] === "MANCA").length;
const w = Math.max(...rows.map((r) => r[1].length));
console.log("\nESITO  PROVA");
for (const [s, n, d] of rows) console.log(`${s}   ${n.padEnd(w)}${d ? "   → " + d : ""}`);
const real = rows.filter((r) => r[0] !== "MANCA");
console.log(`\n${real.length - failed}/${real.length} prove passate`);
if (missing) console.log("ATTENZIONE: le prove del pet NON sono state fatte (migrazione mancante). Vedi la riga MANCA qui sopra.");
process.exit(failed ? 1 : 0);
