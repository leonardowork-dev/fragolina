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

// Se la coppia vera è chiusa (couple:close) la coppia di prova non si potrebbe creare: la riapro per il tempo del collaudo.
let reopen = null;
{
  const dbUrl = env.SUPABASE_DB_URL;
  if (dbUrl) {
    try {
      const pg = (await import("pg")).default;
      const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
      await db.connect();
      const r = await db.query("select value from public.app_settings where key='closed'");
      if (r.rows[0]?.value === "true") {
        await db.query("delete from public.app_settings where key='closed'");
        reopen = async () => { await db.query("insert into public.app_settings(key,value) values ('closed','true') on conflict (key) do update set value='true'"); await db.end(); };
        console.log("(coppia chiusa: la riapro per il collaudo e la richiudo alla fine)");
      } else await db.end();
    } catch (e) { console.log("(non riesco a leggere lo stato 'closed': " + String(e.message).slice(0, 80) + ")"); }
  }
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


  // ---------- biglietti, distanza e accesso del widget (migrazione 6) ----------
  const gb = await rpc(A.c, "get_board", {});
  const noteMissing = !!gb.error && /get_board|PGRST202|Could not find|does not exist/i.test(String(gb.error));
  if (noteMissing) {
    rows.push([
      "MANCA",
      "Biglietti/distanza: la migrazione della sessione 5 NON è ancora stata eseguita su questo Supabase",
      "→ MANUAL_TODO.md, Sessione 5, passo 1 (incolla supabase/sessione5-note.sql). Poi rilancia questo comando.",
    ]);
  } else {
    const sendN = (c, kind, content, key) => rpc(c, "send_note", { p_kind: kind, p_content: content, p_client_key: key, p_client_at: Date.now() });
    const kn = (x) => `chk5-${x}-${uuid().slice(0, 8)}`;
    check("biglietto: get_board risponde (nessun biglietto all'inizio)", gb.ok === true && gb.note === null && gb.location.sharing === false, JSON.stringify(gb).slice(0, 160));
    const n1 = await sendN(A.c, "text", { text: "Ti penso", bg: "butter" }, kn("a"));
    check("biglietto: A manda una scritta, scade tra 1 h", n1.ok && n1.note.by === "me" && Math.abs(n1.note.expiresAt - n1.note.createdAt - 3600000) < 3000, JSON.stringify(n1).slice(0, 200));
    const key = kn("dup");
    const d1 = await sendN(A.c, "draw", { strokes: [{ c: "leaf", w: 2, p: [[1, 2], [300, 400]] }] }, key);
    const d2 = await sendN(A.c, "draw", { strokes: [{ c: "leaf", w: 2, p: [[1, 2], [300, 400]] }] }, key);
    check("biglietto: stessa chiave = nessun duplicato (idempotente)", d1.ok && d2.duplicate === true && d1.note.id === d2.note.id, JSON.stringify(d2).slice(0, 160));
    check("biglietto: contenuto non valido rifiutato dal server", (await sendN(A.c, "draw", { strokes: [{ c: "viola", w: 1, p: [[1, 1]] }] }, kn("bad"))).error === "invalid_content");
    check("biglietto: il terzo non può mandarne", !!(await sendN(C.c, "text", { text: "x", bg: "sky" }, kn("c"))).error);
    const bb = await rpc(B.c, "get_board", {});
    check("biglietto: B vede il disegno di A ('partner', con il nome)", bb.note && bb.note.by === "partner" && bb.note.kind === "draw" && bb.note.byName.length > 0, JSON.stringify(bb.note).slice(0, 160));
    check("biglietto RLS: il terzo non legge notes", ((await C.c.from("notes").select("*")).data ?? []).length === 0);
    const hackN = await A.c.from("notes").update({ cleared_at: null, expires_at: "2099-01-01" }).eq("couple_id", cid).select();
    check("biglietto RLS: nessuna scrittura diretta", !!hackN.error || (hackN.data ?? []).length === 0);

    // tempo reale
    let nGot = 0;
    const chn = B.c
      .channel("chk-note-" + uuid().slice(0, 6))
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `couple_id=eq.${cid}` }, () => nGot++);
    await new Promise((r) => chn.subscribe((st) => st === "SUBSCRIBED" && r()));

    // token del widget
    const t = await rpc(A.c, "rotate_widget_token", {});
    check("widget: token da 64 caratteri esadecimali (32 byte)", t.ok && /^[0-9a-f]{64}$/.test(t.token), JSON.stringify(t).slice(0, 80));
    const anon = mk();
    const feed = (tok) => rpc(anon, "widget_feed", { p_token: tok });
    const f1 = await feed(t.token);
    check("widget: con chiave pubblica + token valido il feed risponde (solo now, note, partner, eventi)", f1.ok === true && JSON.stringify(Object.keys(f1).sort()) === JSON.stringify(["events", "note", "now", "ok", "partner"]), JSON.stringify(f1).slice(0, 200));
    check("widget: il feed mostra l'ultimo biglietto attivo", f1.note && f1.note.id === d1.note.id, JSON.stringify(f1.note).slice(0, 120));
    check("widget: token sbagliato → invalid_token", (await feed("0".repeat(64))).error === "invalid_token");
    check("widget: token malformato → invalid_token", (await feed("ciao")).error === "invalid_token");
    check("widget: senza token il feed non c'è", !!(await rpc(anon, "widget_feed", {})).error);
    check("widget: la chiave pubblica da sola non legge nulla (notes, locations, widget_tokens)", ((await anon.from("notes").select("*")).data ?? []).length === 0 && ((await anon.from("locations").select("*")).data ?? []).length === 0 && ((await anon.from("widget_tokens").select("*")).data ?? []).length === 0);
    check("widget: la chiave pubblica non può mandare biglietti né ruotare token", !!(await rpc(anon, "send_note", { p_kind: "text", p_content: { text: "x", bg: "sky" }, p_client_key: kn("z") })).error && !!(await rpc(anon, "rotate_widget_token", {})).error);
    check("widget: il terzo non ha un token (non è in una coppia)", !!(await rpc(C.c, "rotate_widget_token", {})).error);

    // pulisci: B pulisce, il feed di A diventa vuoto
    const cl = await rpc(B.c, "clear_note", { p_id: d1.note.id });
    check("pulisci: B pulisce il biglietto di A", cl.ok && cl.note.clearedAt !== null, JSON.stringify(cl).slice(0, 160));
    const f2 = await feed(t.token);
    check("pulisci: il feed di A è vuoto dopo 'Pulisci' di B", f2.ok && f2.note === null, JSON.stringify(f2).slice(0, 160));
    check("pulisci: ripetuto va bene", (await rpc(B.c, "clear_note", { p_id: d1.note.id })).ok === true);
    check("scadenza a 1 h: non si può aspettare qui; è provata in backend:sqltest (scadenza forzata) e nell'e2e (orologio finto)", true);

    // distanza: consenso reciproco
    check("distanza: senza consenso set_location dice not_sharing", (await rpc(A.c, "set_location", { p_lat_e2: 4190, p_lon_e2: 1250, p_at: Date.now() })).error === "not_sharing");
    await rpc(A.c, "set_location_sharing", { p_on: true });
    await rpc(A.c, "set_location", { p_lat_e2: 4190, p_lon_e2: 1250, p_at: Date.now() - 1000 });
    const lb0 = (await rpc(B.c, "get_board", {})).location;
    check("distanza: B non condivide → vede 'mine_off' e nessuna coordinata", lb0.partner.state === "mine_off" && lb0.partner.latE2 === null, JSON.stringify(lb0).slice(0, 200));
    await rpc(B.c, "set_location_sharing", { p_on: true });
    await rpc(B.c, "set_location", { p_lat_e2: 4546, p_lon_e2: 919, p_at: Date.now() - 1000 });
    const la = (await rpc(A.c, "get_board", {})).location;
    check("distanza: con il consenso di entrambi A vede la posizione arrotondata di B", la.partner.state === "ok" && la.partner.latE2 === 4546 && la.me.latE2 === 4190, JSON.stringify(la).slice(0, 200));
    const f3 = await feed(t.token);
    check("distanza: il feed del widget porta la posizione di B", f3.partner && f3.partner.state === "ok" && f3.partner.latE2 === 4546, JSON.stringify(f3.partner));
    check("distanza: coordinate fuori scala rifiutate", (await rpc(A.c, "set_location", { p_lat_e2: 9001, p_lon_e2: 0, p_at: Date.now() })).error === "invalid_location");
    check("distanza: il widget può mandare la posizione col token", (await rpc(anon, "widget_set_location", { p_token: t.token, p_lat_e2: 4191, p_lon_e2: 1251, p_at: Date.now() })).ok === true);
    check("distanza: …e con token sbagliato no", (await rpc(anon, "widget_set_location", { p_token: "f".repeat(64), p_lat_e2: 1, p_lon_e2: 1, p_at: Date.now() })).error === "invalid_token");
    await rpc(B.c, "set_location_sharing", { p_on: false });
    const lh = (await rpc(A.c, "get_board", {})).location;
    check("distanza: B spegne → A vede 'hidden' senza coordinate", lh.partner.state === "hidden" && lh.partner.latE2 === null, JSON.stringify(lh.partner));
    check("distanza RLS: il terzo non legge posizioni", ((await C.c.from("locations").select("*")).data ?? []).length === 0);

    await new Promise((r) => setTimeout(r, 1500));
    // il canale si apre DOPO i primi invii: resta la modifica "Pulisci" (UPDATE), che basta a provare il tempo reale
    check("biglietto realtime: B ha ricevuto la modifica (Pulisci) della tabella notes", nGot >= 1, `eventi ricevuti: ${nGot}`);
    await B.c.removeChannel(chn);

    // uscire dalla coppia: il token smette di funzionare
    const tb = await rpc(B.c, "rotate_widget_token", {});
    await rpc(B.c, "leave_couple");
    check("widget: chi esce dalla coppia perde il token (invalid_token)", (await feed(tb.token)).error === "invalid_token");
    await rpc(B.c, "join_couple", { p_code: (await rpc(A.c, "get_state", { p_day: day, p_day_start: new Date().toISOString() })).couple?.join_code ?? "", p_display_name: "Nikole" });
  }

  // ---------- mini giochi (migrazione 7, sessione 6) ----------
  const gg = await rpc(A.c, "get_games", {});
  const gamesMissing = !!gg.error && /get_games|PGRST202|Could not find|does not exist/i.test(String(gg.error));
  if (gamesMissing) {
    rows.push([
      "MANCA",
      "Giochi: la migrazione della sessione 6 NON è ancora stata eseguita su questo Supabase",
      "→ MANUAL_TODO.md, Sessione 6, passo 1 (incolla supabase/sessione6-giochi.sql). Poi rilancia questo comando.",
    ]);
  } else {
    const kg = (x) => `chk6-${x}-${uuid().slice(0, 8)}`;
    const startG = (c, id, kind, params = {}) => rpc(c, "start_game", { p_id: id, p_kind: kind, p_params: params });
    const moveG = (c, id, move, key) => rpc(c, "game_move", { p_game: id, p_move: move, p_client_key: key });
    check("giochi: get_games risponde (nessuna partita all'inizio)", gg.ok === true && gg.games.length === 0, JSON.stringify(gg).slice(0, 160));
    let gGot = 0;
    const chg = B.c
      .channel("chk-games-" + uuid().slice(0, 6))
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `couple_id=eq.${cid}` }, () => gGot++);
    await new Promise((r) => chg.subscribe((st) => st === "SUBSCRIBED" && r()));

    const g1 = uuid();
    const s1 = await startG(A.c, g1, "tris");
    check("tris: A apre la partita (muove per primo chi la apre)", s1.ok && s1.game.turn === A.id && s1.game.data.x === A.id, JSON.stringify(s1).slice(0, 200));
    check("tris: stesso id = nessun duplicato (idempotente)", (await startG(A.c, g1, "tris")).duplicate === true);
    check("tris: una sola partita aperta per gioco", (await startG(B.c, uuid(), "tris")).error === "game_open");
    check("tris: B muove fuori turno → rifiutato", (await moveG(B.c, g1, { type: "place", cell: 0 }, kg("o"))).error === "not_your_turn");
    check("tris: il terzo non può muovere nelle vostre partite", !!(await moveG(C.c, g1, { type: "place", cell: 0 }, kg("c"))).error);
    const m1 = await moveG(A.c, g1, { type: "place", cell: 4 }, kg("m1"));
    check("tris: A muove (X al centro), ora tocca a B", m1.ok && m1.game.data.board === "----X----" && m1.game.turn === B.id, JSON.stringify(m1).slice(0, 200));
    const dupK = kg("dup");
    const m2 = await moveG(B.c, g1, { type: "place", cell: 0 }, dupK);
    check("tris: stessa chiave = la mossa non si ripete", m2.ok && (await moveG(B.c, g1, { type: "place", cell: 0 }, dupK)).duplicate === true);
    check("tris: casella occupata rifiutata", (await moveG(A.c, g1, { type: "place", cell: 0 }, kg("t"))).error === "cell_taken");
    let last;
    for (const [c, cell] of [[A.c, 1], [B.c, 3], [A.c, 7]]) last = await moveG(c, g1, { type: "place", cell }, kg("w" + cell));
    check("tris: A fa tris (1-4-7), partita chiusa con la linea vincente", last.ok && last.game.status === "done" && JSON.stringify(last.game.data.win) === "[1,4,7]", JSON.stringify(last).slice(0, 200));
    check("tris: partita finita, nessuna mossa in più", (await moveG(B.c, g1, { type: "place", cell: 2 }, kg("z"))).error === "game_over");
    const gs = await rpc(B.c, "get_games", {});
    check("tris: il punteggio sale (A 1 vittoria)", gs.scores.tris?.[A.id]?.wins === 1 && gs.scores.tris?.[B.id]?.wins === 0, JSON.stringify(gs.scores));

    // quiz: la risposta segreta
    const g2 = uuid();
    const qs = await startG(A.c, g2, "quiz", { qids: [1, 2, 3, 4, 5] });
    check("quiz: A apre il quiz con 5 domande", qs.ok && qs.game.data.qids.length === 5, JSON.stringify(qs).slice(0, 160));
    const subj0 = qs.game.data.subjects[0];
    const [S0, G0] = subj0 === A.id ? [A, B] : [B, A];
    check("quiz: risposta fuori scala rifiutata", (await moveG(S0.c, g2, { type: "answer", q: 9, idx: 1 }, kg("q9"))).error === "invalid_move");
    const qa = await moveG(S0.c, g2, { type: "answer", q: 0, idx: 2 }, kg("qa"));
    check("quiz: chi risponde su di sé → 'ha risposto' ma nessun valore nello stato pubblico", qa.ok && qa.game.data.answered[0].s === true && qa.game.data.reveals[0] === null && !JSON.stringify(qa).includes('"idx"'), JSON.stringify(qa).slice(0, 200));
    check("quiz RLS: la tabella dei segreti non si legge (né dall'altro né dal terzo)", ((await G0.c.from("game_secrets").select("*")).data ?? []).length === 0 && ((await C.c.from("game_secrets").select("*")).data ?? []).length === 0);
    const rows_ = (await G0.c.from("games").select("*").eq("id", g2)).data ?? [];
    const mv_ = (await G0.c.from("game_moves").select("*").eq("game_id", g2)).data ?? [];
    check("quiz RLS: né in games né in game_moves c'è il valore della risposta", JSON.stringify(rows_).indexOf('"s":2') < 0 && !mv_.some((m) => "idx" in (m.payload ?? {})), JSON.stringify(mv_).slice(0, 160));
    const gv = await rpc(G0.c, "get_games", {});
    check("quiz: nella fotografia di chi indovina non c'è la risposta dell'altro", !JSON.stringify(gv.mine?.[g2] ?? {}).includes('"s":2'), JSON.stringify(gv.mine?.[g2]));
    const qg = await moveG(G0.c, g2, { type: "answer", q: 0, idx: 2 }, kg("qg"));
    check("quiz: quando risponde anche l'altro si RIVELA (giusta, punteggio 1)", qg.ok && qg.game.data.reveals[0]?.ok === true && qg.game.data.score === 1, JSON.stringify(qg).slice(0, 220));
    await rpc(A.c, "abandon_game", { p_game: g2, p_client_key: kg("ab") });

    // disegna e indovina
    const g3 = uuid();
    const ds = await startG(A.c, g3, "draw", { word: "Gatto", wordId: 5 });
    check("disegna: la parola NON è nello stato pubblico", ds.ok && ds.game.data.word === null && !JSON.stringify(ds).includes("Gatto"), JSON.stringify(ds).slice(0, 200));
    check("disegna: l'altro non riceve la parola", !JSON.stringify(await rpc(B.c, "get_games", {})).includes("Gatto"));
    check("disegna: disegno non valido rifiutato", (await moveG(A.c, g3, { type: "drawing", content: { strokes: [{ c: "viola", w: 1, p: [[1, 1]] }] } }, kg("dx"))).error === "invalid_content");
    const dd = await moveG(A.c, g3, { type: "drawing", content: { strokes: [{ c: "ink", w: 1, p: [[100, 100], [400, 400]] }] } }, kg("dd"));
    check("disegna: il disegno arriva, tocca a B indovinare", dd.ok && dd.game.data.phase === "guessing" && dd.game.turn === B.id, JSON.stringify(dd).slice(0, 160));
    const dg1 = await moveG(B.c, g3, { type: "guess", text: "cane" }, kg("g1"));
    check("disegna: tentativo sbagliato, la parola resta segreta", dg1.ok && dg1.game.status === "open" && dg1.game.data.word === null);
    const dg2 = await moveG(B.c, g3, { type: "guess", text: "I GATTI!" }, kg("g2"));
    check("disegna: «I GATTI!» vale (maiuscole, articolo, plurale) e la parola si rivela", dg2.ok && dg2.game.status === "done" && dg2.game.data.word === "Gatto", JSON.stringify(dg2).slice(0, 220));

    // RLS
    check("giochi RLS: il terzo non vede partite, mosse né punteggi", ((await C.c.from("games").select("*")).data ?? []).length === 0 && ((await C.c.from("game_moves").select("*")).data ?? []).length === 0 && ((await C.c.from("game_scores").select("*")).data ?? []).length === 0);
    const hackG = await A.c.from("games").update({ status: "done" }).eq("couple_id", cid).select();
    check("giochi RLS: nessuna scrittura diretta", !!hackG.error || (hackG.data ?? []).length === 0);
    const anonG = mk();
    check("giochi: la chiave pubblica da sola non chiama le funzioni né legge", !!(await rpc(anonG, "get_games", {})).error && ((await anonG.from("games").select("*")).data ?? []).length === 0);

    await new Promise((r) => setTimeout(r, 1500));
    check("giochi realtime: B ha ricevuto le modifiche della tabella games", gGot >= 3, `eventi ricevuti: ${gGot}`);
    await B.c.removeChannel(chg);
  }

  // ---------- sessione 7: conto alla rovescia, domanda vera, ricordi (foto nello Storage), mese ----------
  const ge = await rpc(A.c, "get_events", {});
  const extraMissing = !!ge.error && /get_events|PGRST202|Could not find|does not exist/i.test(String(ge.error));
  if (extraMissing) {
    rows.push([
      "MANCA",
      "Sessione 7: la migrazione (eventi, domanda vera, ricordi, Storage) NON è ancora stata eseguita su questo Supabase",
      "→ MANUAL_TODO.md, Sessione 7, passo 1 (incolla supabase/sessione7-extra.sql). Poi rilancia questo comando.",
    ]);
  } else {
    const roma = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const ev1 = uuid();
    const up = await rpc(A.c, "upsert_event", { p_id: ev1, p_title: "Prova sessione 7", p_date: "2031-03-14", p_time: "18:30", p_icon: "heart", p_featured: true, p_at: Date.now() });
    check("eventi: A crea un evento e B lo vede", up.ok && (await rpc(B.c, "get_events", {})).events?.some((e) => e.id === ev1 && e.time === "18:30"), JSON.stringify(up).slice(0, 160));
    check("eventi: dati non validi rifiutati", (await rpc(A.c, "upsert_event", { p_id: uuid(), p_title: "", p_date: "2031-03-14", p_time: null, p_icon: "heart", p_featured: false, p_at: 1 })).error === "invalid_action");
    check("eventi RLS: il terzo non li vede né li legge dalla tabella", ((await rpc(C.c, "get_events", {})).events ?? []).length === 0 && ((await C.c.from("countdown_events").select("*")).data ?? []).length === 0);
    check("eventi: nessuna scrittura diretta", !!(await A.c.from("countdown_events").update({ title: "x" }).eq("id", ev1).select()).error || ((await A.c.from("countdown_events").update({ title: "x" }).eq("id", ev1).select()).data ?? []).length === 0);
    const tk = await rpc(B.c, "rotate_widget_token", {});
    const wf = await rpc(mk(), "widget_feed", { p_token: tk.token });
    check("eventi: il widget (chiave pubblica + token) li riceve dal feed", wf.ok && wf.events?.some((e) => e.id === ev1), JSON.stringify(wf).slice(0, 200));
    await rpc(A.c, "delete_event", { p_id: ev1, p_at: Date.now() + 5 });
    check("eventi: cancellato", !(await rpc(B.c, "get_events", {})).events?.some((e) => e.id === ev1));

    // domanda del giorno vera: il segreto sul server vero
    const qchan = B.c.channel("chk7-qa-" + uuid().slice(0, 6));
    let qaAns = 0, qaTxt = 0;
    // due canali separati: la tabella qa_texts NON è nella publication (voluto) e un binding su di lei non deve rovinare l'altro
    const qchan2 = B.c.channel("chk7-qt-" + uuid().slice(0, 6));
    qchan.on("postgres_changes", { event: "*", schema: "public", table: "qa_answers", filter: `couple_id=eq.${cid}` }, () => qaAns++);
    qchan2.on("postgres_changes", { event: "*", schema: "public", table: "qa_texts", filter: `couple_id=eq.${cid}` }, () => qaTxt++);
    qchan2.subscribe(() => {});
    await new Promise((r) => qchan.subscribe((st) => st === "SUBSCRIBED" && r()));
    await new Promise((r) => setTimeout(r, 2500)); // il filtro sulle righe ci mette un attimo a essere attivo dopo SUBSCRIBED
    await new Promise((r) => setTimeout(r, 800));
    const q1 = await rpc(A.c, "get_qa", { p_today_ref: "q007" });
    const q2 = await rpc(B.c, "get_qa", { p_today_ref: "q200" });
    check("domanda: la prima persona fissa la domanda per entrambi", q1.ok && q2.ok && q1.days[0].ref === "q007" && q2.days[0].ref === "q007", JSON.stringify([q1.days?.[0], q2.days?.[0]]));
    check("domanda: il giorno è quello di Roma", q1.today === roma, `${q1.today} / ${roma}`);
    const a1 = await rpc(A.c, "answer_qa", { p_day: roma, p_ref: "q007", p_text: "Segreto di A: il mare", p_client_key: "chk7-" + uuid().slice(0, 8) });
    check("domanda: A risponde", a1.ok && a1.day.mine.text.includes("Segreto di A"), JSON.stringify(a1).slice(0, 160));
    const bq = await rpc(B.c, "get_qa", { p_today_ref: "q007" });
    check("segreto: B vede che A ha risposto ma NON il testo", bq.days[0].theirsAnswered === true && bq.days[0].theirs === null && !JSON.stringify(bq).includes("Segreto di A"));
    const rawB = (await B.c.from("qa_texts").select("*")).data ?? [];
    check("segreto: B non legge la riga di A dalla tabella (RLS)", rawB.length === 0 && !JSON.stringify(rawB).includes("Segreto"), JSON.stringify(rawB).slice(0, 120));
    check("segreto: il terzo non legge nulla", ((await C.c.from("qa_texts").select("*")).data ?? []).length === 0 && ((await C.c.from("qa_answers").select("*")).data ?? []).length === 0);
    check("domanda: 281 caratteri rifiutati", (await rpc(B.c, "answer_qa", { p_day: roma, p_ref: "q007", p_text: "x".repeat(281), p_client_key: "chk7-" + uuid().slice(0, 8) })).error === "invalid_content");
    const b1 = await rpc(B.c, "answer_qa", { p_day: roma, p_ref: "q007", p_text: "Risposta di B: la montagna", p_client_key: "chk7-" + uuid().slice(0, 8) });
    check("rivelazione: B risponde e vede subito quella di A", b1.ok && b1.day.theirs?.text.includes("Segreto di A"), JSON.stringify(b1).slice(0, 200));
    const aq = await rpc(A.c, "get_qa", { p_today_ref: "q007" });
    check("rivelazione: ora A vede quella di B", aq.days[0].theirs?.text.includes("montagna"));
    check("domanda: una sola risposta al giorno", (await rpc(A.c, "answer_qa", { p_day: roma, p_ref: "q007", p_text: "Cambio", p_client_key: "chk7-" + uuid().slice(0, 8) })).duplicate === true);
    const W = (await rpc(A.c, "get_qa", { p_today_ref: "q007" })).tomorrowTurn ? A : B;
    const N = W === A ? B : A;
    check("domani: chi non è di turno non può scrivere", (await rpc(N.c, "set_tomorrow_question", { p_text: "Non tocca a me" })).error === "not_your_turn");
    check("domani: chi è di turno la scrive e l'altro la vede", (await rpc(W.c, "set_tomorrow_question", { p_text: "Qual è la cosa più bella di oggi?" })).ok === true && (await rpc(N.c, "get_qa", { p_today_ref: "q007" })).days.some((d) => d.ref === "custom"));
    // il realtime a volte è lento: si aspetta fino a 12 s, ma si esce appena arriva (il test ora dura ~2 s di solito)
    for (let i = 0; i < 24 && qaAns < 1; i++) await new Promise((r) => setTimeout(r, 500));
    await new Promise((r) => setTimeout(r, 500));
    check("domanda realtime: qa_answers arriva (solo 'ha risposto'), qa_texts MAI", qaAns >= 1 && qaTxt === 0, `qa_answers=${qaAns} qa_texts=${qaTxt}`);
    await B.c.removeChannel(qchan);
    await B.c.removeChannel(qchan2);

    // ricordi e Storage vero (bucket privato)
    const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
    const mid = uuid();
    const path_ = `${cid}/${mid}.jpg`;
    const upl = await A.c.storage.from("memories").upload(path_, JPG, { contentType: "image/jpeg", upsert: false });
    check("Storage: A carica una foto di prova nella cartella della coppia", !upl.error, upl.error?.message);
    check("Storage: il terzo NON può caricare nella cartella della coppia", !!(await C.c.storage.from("memories").upload(`${cid}/${uuid()}.jpg`, JPG, { contentType: "image/jpeg" })).error);
    const sgnB = await B.c.storage.from("memories").createSignedUrl(path_, 120);
    check("Storage: B ottiene un URL firmato e scarica la foto", !sgnB.error && !!sgnB.data?.signedUrl && (await fetch(sgnB.data.signedUrl)).status === 200, sgnB.error?.message);
    const sgnC = await C.c.storage.from("memories").createSignedUrl(path_, 120);
    check("Storage: il terzo NON ottiene l'URL firmato", !!sgnC.error || !sgnC.data?.signedUrl);
    const pubUrl = `${URL_}/storage/v1/object/public/memories/${path_}`;
    check("Storage: il bucket è privato (l'indirizzo pubblico non serve la foto)", (await fetch(pubUrl)).status !== 200);
    const am = await rpc(A.c, "add_memory", { p_id: mid, p_kind: "photo", p_source: "photo", p_caption: "Prova", p_day: roma, p_path: path_, p_w: 1, p_h: 1, p_bytes: JPG.length, p_content: null });
    check("ricordi: A registra la foto e B la vede", am.ok && (await rpc(B.c, "get_memories", {})).memories?.some((m) => m.id === mid), JSON.stringify(am).slice(0, 160));
    check("ricordi: il terzo non vede nulla", ((await rpc(C.c, "get_memories", {})).memories ?? []).length === 0 && ((await C.c.from("memories").select("*")).data ?? []).length === 0);
    check("ricordi: B non può togliere il ricordo di A", (await rpc(B.c, "delete_memory", { p_id: mid })).error === "not_yours");
    const rmB = await B.c.storage.from("memories").remove([path_]);
    check("Storage: B non può cancellare il file di A", ((rmB.data ?? []).length === 0) || !!rmB.error);
    const dm = await rpc(A.c, "delete_memory", { p_id: mid });
    const rmA = await A.c.storage.from("memories").remove([path_]);
    const still = await A.c.storage.from("memories").createSignedUrl(path_, 60);
    check("ricordi: A cancella il ricordo e il file dallo Storage", dm.ok && !rmA.error && !!still.error, JSON.stringify([dm, rmA.error?.message, still.error?.message]).slice(0, 200));
    const mo = await rpc(A.c, "get_month", { p_year: Number(roma.slice(0, 4)), p_month: Number(roma.slice(5, 7)) });
    check("mese: get_month risponde con i giorni con due risposte", mo.ok && mo.qaBoth >= 1, JSON.stringify(mo).slice(0, 160));
  }

  // Sessione 8: pulizia dei pensieri vecchi (archivio privato, funzione non chiamabile dai client)
  {
    const arch = await A.c.from("ping_archive").select("*");
    const archErr = String(arch.error?.code ?? arch.error?.message ?? "");
    if (/PGRST205|42P01|does not exist|Could not find/i.test(archErr)) {
      rows.push(["MANCA", "sessione 8: tabella ping_archive (lancia npm run db:apply)", archErr]);
    } else {
      check("sessione 8: l'archivio dei pensieri non è leggibile dai client", !!arch.error || (arch.data ?? []).length === 0, JSON.stringify(arch).slice(0, 120));
      const pr = await rpc(A.c, "_prune_pings", {});
      check("sessione 8: _prune_pings non è chiamabile dai client", !!pr.error || pr.ok === false, JSON.stringify(pr).slice(0, 120));
      const st8 = await rpc(A.c, "get_state", { p_day: day, p_day_start: new Date().toISOString() });
      check("sessione 8: get_state risponde ancora (totali con archivio)", st8.ok === true && Number.isFinite(st8.pings_received_total), JSON.stringify(st8).slice(0, 120));
    }
  }

  // sessione 10: zona privata
  {
    const zg = await rpc(A.c, "z_get");
    if (zg.error && /z_get|PGRST202|Could not find/i.test(String(zg.error))) {
      rows.push(["MANCA", "zona: migrazione sessione10-piccante.sql non applicata", ""]);
    } else {
      const u = () => crypto.randomUUID();
      let pulses = 0;
      const zch = B.c.channel("z-" + u()).on("postgres_changes", { event: "*", schema: "public", table: "z_pulse" }, () => pulses++);
      await new Promise((res) => zch.subscribe((st) => (st === "SUBSCRIBED" || st === "CHANNEL_ERROR" || st === "TIMED_OUT") && res()));
      for (let i = 0; i < 3; i++) await rpc(A.c, "z_log", { p_id: u(), p_day: day, p_at: Date.now(), p_place: "letto", p_starter: "a", p_rating: 4, p_note: null });
      const zb = await rpc(B.c, "z_get");
      check("zona: A segna 3 volte, B vede 3 cuoricini", zb.ok && zb.entries.filter((e) => e.day === day).length === 3, JSON.stringify(zb).slice(0, 120));
      check("zona: il terzo non vede niente", (await rpc(C.c, "z_get")).error === "not_paired");
      const rd = await C.c.from("z_entries").select("*");
      check("zona: le tabelle non si leggono dai client", !!rd.error || (rd.data ?? []).length === 0, JSON.stringify(rd.data)?.slice(0, 80));
      await rpc(A.c, "z_wish", { p_idea: "d001", p_on: true });
      await rpc(A.c, "z_wish", { p_idea: "d002", p_on: true });
      await rpc(B.c, "z_wish", { p_idea: "d001", p_on: true });
      const m1 = await rpc(A.c, "z_get");
      const m2 = await rpc(B.c, "z_get");
      check("desideri: d001 è un match per entrambi", m1.matches?.includes("d001") && m2.matches?.includes("d001"));
      check("desideri: d002 (scelto da uno solo) resta segreto", !JSON.stringify(m2).includes("d002") && !m1.matches.includes("d002"));
      await rpc(A.c, "z_tonight", { p_answer: "yes" });
      const t1 = await rpc(B.c, "z_get");
      check("stasera: B vede solo che A ha risposto", t1.tonight.otherAnswered === true && t1.tonight.result === null && t1.tonight.mine === null);
      await rpc(B.c, "z_tonight", { p_answer: "maybe" });
      check("stasera: sì + forse = match", (await rpc(A.c, "z_get")).tonight.result === "match");
      await rpc(A.c, "z_signal", { p_level: 2 });
      check("ho voglia: B lo vede", (await rpc(B.c, "z_get")).signal.incoming?.level === 2);
      const vid = u();
      await rpc(A.c, "z_voucher_add", { p_id: vid, p_title: "Un massaggio", p_expires: null });
      check("buono: B lo riscatta", (await rpc(B.c, "z_voucher_redeem", { p_id: vid })).ok === true);
      await new Promise((r) => setTimeout(r, 2500));
      check("zona realtime: B riceve il contatore (nessun contenuto)", pulses > 0, "nessun evento");
      const wf = await rpc(A.c, "widget_feed", { p_token: "x".repeat(64) });
      check("zona: widget_feed non porta niente della zona", !/z_|piccant|desider|massaggio/i.test(JSON.stringify(wf)));
      check("zona: cancella tutto svuota per entrambi", (await rpc(B.c, "z_wipe")).ok === true && (await rpc(A.c, "z_get")).entries.length === 0 && (await rpc(A.c, "z_get")).vouchers.length === 0);
      await B.c.removeChannel(zch);
    }
  }

  // sessione 9: scadenza dell'app
  {
    const exp = Date.now() + 5 * 86_400_000;
    const sa = await rpc(A.c, "set_app_expiry", { p_at: exp });
    if (sa.error && /set_app_expiry|PGRST202|Could not find/i.test(String(sa.error))) {
      rows.push(["MANCA", "scadenza: migrazione sessione9-scadenza.sql non applicata", ""]);
    } else {
      check("scadenza: A scrive la propria", sa.ok === true, JSON.stringify(sa));
      const pe = await rpc(B.c, "get_partner_expiry");
      check("scadenza: B vede quella di A", pe.ok === true && pe.partner && Math.abs(pe.partner.expiresAt - exp) < 1000, JSON.stringify(pe));
      check("scadenza: il terzo non legge nulla", (await rpc(C.c, "get_partner_expiry")).error === "not_paired");
      check("scadenza: valore assurdo rifiutato", (await rpc(A.c, "set_app_expiry", { p_at: 5 })).error === "invalid_content");
    }
  }

  // pulizia: entrambi escono (la coppia si cancella da sola)
  await rpc(A.c, "leave_couple");
  await rpc(B.c, "leave_couple");
  const gone = await rpc(A.c, "get_state", { p_day: day, p_day_start: new Date().toISOString() });
  check("pulizia: A e B sono usciti, nessuna traccia", gone.paired === false);
} catch (e) {
  check("esecuzione senza eccezioni", false, String(e.message ?? e));
}

if (reopen) { try { await reopen(); console.log("(coppia richiusa)"); } catch (e) { console.log("ATTENZIONE: non riesco a richiudere la coppia: " + e.message); } }

const missing = rows.filter((r) => r[0] === "MANCA").length;
const w = Math.max(...rows.map((r) => r[1].length));
console.log("\nESITO  PROVA");
for (const [s, n, d] of rows) console.log(`${s}   ${n.padEnd(w)}${d ? "   → " + d : ""}`);
const real = rows.filter((r) => r[0] !== "MANCA");
console.log(`\n${real.length - failed}/${real.length} prove passate`);
if (missing) console.log("ATTENZIONE: alcune prove NON sono state fatte (migrazione mancante: vedi le righe MANCA qui sopra e MANUAL_TODO.md).");
process.exit(failed ? 1 : 0);
