-- Fragolina · SOLO LA MIGRAZIONE DEI BIGLIETTI, DELLA DISTANZA E DEL WIDGET (sessione 5). Generato da scripts/build-sql.mjs: non modificarlo a mano.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non tocca nulla di ciò che c'è già.
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.

-- Fragolina · migrazione 6 · biglietti sul widget, distanza, accesso del widget (sessione 5).
-- Idempotente: si può rieseguire senza danni. NON tocca nulla delle migrazioni 1-5.
--
--  • notes            il "biglietto" (disegno a vettori o scritta), scade dopo 1 ora, "Pulisci" per entrambi.
--  • locations        l'ULTIMA posizione di ciascuno, già arrotondata (centesimi di grado ≈ 1 km), solo se condivisa.
--  • widget_tokens    un segreto casuale (32 byte) per persona, salvato come hash: serve al WIDGET per leggere il feed.
--  • widget_feed      l'unica porta del widget (Percorso B): restituisce SOLO il biglietto attivo e la posizione
--                     dell'altra persona (se entrambe condividete). Chiave pubblica + token, nessuna sessione.
-- Si scrive SOLO con le funzioni (send_note, clear_note, set_location…): nessuna scrittura diretta dai telefoni.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('draw', 'text')),
  content jsonb not null,
  client_key text not null check (char_length(client_key) between 8 and 64),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  cleared_at timestamptz,
  cleared_by uuid,
  unique (user_id, client_key)
);
create index if not exists notes_couple_created_idx on public.notes (couple_id, created_at desc);
create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

create table if not exists public.locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  sharing boolean not null default false,
  lat_e2 int check (lat_e2 is null or lat_e2 between -9000 and 9000),
  lon_e2 int check (lon_e2 is null or lon_e2 between -18000 and 18000),
  at bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists locations_couple_idx on public.locations (couple_id);

create table if not exists public.widget_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- ---------- Regole del biglietto (specchio di src/lib/note/rules.ts) ----------

create or replace function public._note_valid(p_kind text, c jsonb) returns boolean
language plpgsql immutable as $$
declare r record; pt record; n int := 0; ns int := 0; np int;
begin
  if c is null or jsonb_typeof(c) <> 'object' then return false; end if;
  if p_kind = 'text' then
    return jsonb_typeof(c->'text') = 'string'
       and char_length(btrim(c->>'text')) between 1 and 80
       and (c->>'bg') in ('butter','blush','sky','leaf','strawberry','paper');
  end if;
  if p_kind <> 'draw' or jsonb_typeof(c->'strokes') <> 'array' then return false; end if;
  if octet_length(c::text) > 24576 then return false; end if;
  ns := jsonb_array_length(c->'strokes');
  if ns < 1 or ns > 40 then return false; end if;
  for r in select value as s from jsonb_array_elements(c->'strokes') loop
    if jsonb_typeof(r.s) <> 'object'
       or (r.s->>'c') is null or (r.s->>'c') not in ('ink','strawberry','leaf','sky','butter')
       or (r.s->>'w') is null or (r.s->>'w') not in ('1','2')
       or jsonb_typeof(r.s->'p') <> 'array' then return false; end if;
    np := jsonb_array_length(r.s->'p');
    if np < 1 or np > 400 then return false; end if;
    n := n + np;
    if n > 1500 then return false; end if;
    for pt in select value as q from jsonb_array_elements(r.s->'p') loop
      if jsonb_typeof(pt.q) <> 'array' or jsonb_array_length(pt.q) <> 2
         or jsonb_typeof(pt.q->0) <> 'number' or jsonb_typeof(pt.q->1) <> 'number'
         or (pt.q->>0) !~ '^\d{1,4}$' or (pt.q->>1) !~ '^\d{1,4}$'
         or (pt.q->>0)::int > 1000 or (pt.q->>1)::int > 1000 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;

-- (stessa funzione della migrazione 5: ridefinita qui perché questa migrazione non dipenda da quella)
create or replace function public._now_ms() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;
revoke all on function public._now_ms() from public, anon, authenticated;

create or replace function public._ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function public._note_json(n public.notes, viewer uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when n.id is null then null else jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'content', n.content,
    'by', case when n.user_id = viewer then 'me' else 'partner' end,
    'byName', coalesce((select display_name from public.couple_members m where m.user_id = n.user_id), ''),
    'createdAt', public._ms(n.created_at), 'expiresAt', public._ms(n.expires_at),
    'clearedAt', case when n.cleared_at is null then null else public._ms(n.cleared_at) end
  ) end
$$;

-- Il biglietto di adesso: l'ULTIMO della coppia (un biglietto nuovo sostituisce il vecchio). active_only = solo se vivo.
create or replace function public._note_latest(cid uuid, viewer uuid, active_only boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n public.notes;
begin
  select * into n from public.notes where couple_id = cid order by created_at desc limit 1;
  if not found then return null; end if;
  if active_only and (n.cleared_at is not null or n.expires_at <= now()) then return null; end if;
  return public._note_json(n, viewer);
end $$;

-- ---------- Posizione e distanza ----------

create or replace function public._loc_state(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cid uuid; mine public.locations; pid uuid; pname text; theirs public.locations; st text;
begin
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('sharing', false, 'me', null, 'partner', null); end if;
  select * into mine from public.locations where user_id = uid;
  select user_id, display_name into pid, pname from public.couple_members where couple_id = cid and user_id <> uid;
  if pid is null then
    return jsonb_build_object('sharing', coalesce(mine.sharing, false),
      'me', case when mine.lat_e2 is null then null else jsonb_build_object('latE2', mine.lat_e2, 'lonE2', mine.lon_e2, 'at', mine.at) end,
      'partner', null);
  end if;
  select * into theirs from public.locations where user_id = pid;
  -- Consenso reciproco: la posizione dell'altra persona si vede solo se condividi anche tu.
  st := case
    when not coalesce(mine.sharing, false) then 'mine_off'
    when theirs.user_id is null then 'none'
    when not theirs.sharing then 'hidden'
    when theirs.lat_e2 is null then 'none'
    else 'ok' end;
  return jsonb_build_object(
    'sharing', coalesce(mine.sharing, false),
    'me', case when mine.lat_e2 is null then null else jsonb_build_object('latE2', mine.lat_e2, 'lonE2', mine.lon_e2, 'at', mine.at) end,
    'partner', jsonb_build_object('name', pname, 'state', st,
      'latE2', case when st = 'ok' then theirs.lat_e2 else null end,
      'lonE2', case when st = 'ok' then theirs.lon_e2 else null end,
      'at', case when st = 'ok' then theirs.at else null end));
end $$;

create or replace function public._set_location(uid uuid, p_lat int, p_lon int, p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare cid uuid; cur public.locations; nowms bigint := public._now_ms(); t bigint;
begin
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_lat is null or p_lon is null or p_lat not between -9000 and 9000 or p_lon not between -18000 and 18000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_location');
  end if;
  if (select count(*) from public.rate_events where kind = 'loc' and user_id = uid and at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events (kind, user_id) values ('loc', uid);
  select * into cur from public.locations where user_id = uid;
  if cur.user_id is null or not cur.sharing then
    return jsonb_build_object('ok', false, 'error', 'not_sharing');
  end if;
  t := greatest(least(coalesce(p_at, nowms), nowms), nowms - 604800000);
  if t < cur.at then return jsonb_build_object('ok', true, 'ignored', true); end if;
  update public.locations set lat_e2 = p_lat, lon_e2 = p_lon, at = t, updated_at = now() where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_location_sharing(p_on boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_on is null then return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  insert into public.locations (user_id, couple_id, sharing) values (uid, cid, p_on)
  on conflict (user_id) do update set
    sharing = p_on, couple_id = cid,
    -- spento: si cancella anche l'ultima posizione (non resta nulla sul server)
    lat_e2 = case when p_on then public.locations.lat_e2 else null end,
    lon_e2 = case when p_on then public.locations.lon_e2 else null end,
    at = case when p_on then public.locations.at else 0 end,
    updated_at = now();
  return jsonb_build_object('ok', true, 'sharing', p_on);
end $$;

create or replace function public.set_location(p_lat_e2 int, p_lon_e2 int, p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  return public._set_location(auth.uid(), p_lat_e2, p_lon_e2, p_at);
end $$;

-- ---------- Biglietti ----------

create or replace function public.send_note(p_kind text, p_content jsonb, p_client_key text, p_client_at bigint default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid; dup public.notes; n public.notes;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_kind is null or p_kind not in ('draw','text') or p_client_key is null or char_length(p_client_key) not between 8 and 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;

  select * into dup from public.notes where user_id = uid and client_key = p_client_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'note', public._note_json(dup, uid));
  end if;

  if (select count(*) from public.notes where user_id = uid and created_at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if not public._note_valid(p_kind, p_content) then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;

  insert into public.notes (couple_id, user_id, kind, content, client_key, expires_at)
  values (cid, uid, p_kind, p_content, p_client_key, now() + interval '1 hour')
  returning * into n;

  -- storico corto: tengo gli ultimi 30 biglietti della coppia
  delete from public.notes where couple_id = cid and id in (
    select id from public.notes where couple_id = cid order by created_at desc offset 30
  );
  return jsonb_build_object('ok', true, 'note', public._note_json(n, uid));
end $$;

-- Pulisci: chiunque dei due. Con un id pulisce quel biglietto (se nel frattempo ne è arrivato uno nuovo, quello nuovo
-- non si tocca); senza id pulisce l'ultimo. Ripetuto o già scaduto: va bene lo stesso.
create or replace function public.clear_note(p_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; n public.notes;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_id is null then
    select * into n from public.notes where couple_id = cid order by created_at desc limit 1 for update;
  else
    select * into n from public.notes where id = p_id and couple_id = cid for update;
  end if;
  if not found then return jsonb_build_object('ok', true, 'none', true, 'note', null); end if;
  if n.cleared_at is null then
    update public.notes set cleared_at = now(), cleared_by = uid where id = n.id returning * into n;
  end if;
  return jsonb_build_object('ok', true, 'note', public._note_json(n, uid));
end $$;

-- Tutto quello che serve all'app in una chiamata: ultimo biglietto (anche scaduto/pulito: lo stato lo calcola il
-- telefono) e posizioni.
create or replace function public.get_board() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  return jsonb_build_object('ok', true, 'now', public._now_ms(),
    'note', public._note_latest(cid, uid, false), 'location', public._loc_state(uid));
end $$;

-- ---------- Accesso del widget (Percorso B) ----------

create or replace function public.rotate_widget_token() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); tok text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if not exists (select 1 from public.couple_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'not_paired');
  end if;
  if (select count(*) from public.rate_events where kind = 'wtoken' and user_id = uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events (kind, user_id) values ('wtoken', uid);
  tok := encode(gen_random_bytes(32), 'hex');
  insert into public.widget_tokens (user_id, token_hash) values (uid, encode(digest(tok, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return jsonb_build_object('ok', true, 'token', tok);
end $$;

-- Chi lascia la coppia perde token e posizione (anche quando l'altra persona lo "libera").
create or replace function public.tg_member_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.widget_tokens where user_id = old.user_id;
  delete from public.locations where user_id = old.user_id;
  return old;
end $$;
drop trigger if exists couple_members_cleanup on public.couple_members;
create trigger couple_members_cleanup after delete on public.couple_members
  for each row execute function public.tg_member_cleanup();

-- Token → persona (null se il token non esiste). Un token valido non viene mai bloccato dagli errori altrui.
create or replace function public._token_user(p_token text) returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select t.user_id into uid from public.widget_tokens t where t.token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return uid;
end $$;

-- Token sbagliato: si registra (con un tetto, perché il registro non cresca all'infinito) e si risponde invalid_token.
create or replace function public._token_fail() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.rate_events where kind = 'widget_bad' and at < now() - interval '1 hour';
  if (select count(*) from public.rate_events where kind = 'widget_bad' and at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events (kind, user_id) values ('widget_bad', null);
  return jsonb_build_object('ok', false, 'error', 'invalid_token');
end $$;

-- Il feed del widget. NIENTE sessione: bastano la chiave pubblica e il token. Restituisce solo ciò che serve.
create or replace function public.widget_feed(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid; cid uuid; nowms bigint := public._now_ms(); loc jsonb;
begin
  uid := public._token_user(p_token);
  if uid is null then return public._token_fail(); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then
    delete from public.widget_tokens where user_id = uid;
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  delete from public.rate_events where kind = 'widget_feed' and user_id = uid and at < now() - interval '2 hours';
  if (select count(*) from public.rate_events where kind = 'widget_feed' and user_id = uid and at > now() - interval '1 hour') >= 240 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events (kind, user_id) values ('widget_feed', uid);
  update public.widget_tokens set last_used_at = now() where user_id = uid;
  loc := public._loc_state(uid);
  return jsonb_build_object('ok', true, 'now', nowms,
    'note', public._note_latest(cid, uid, true),
    'partner', loc->'partner');
end $$;

-- Posizione dal telefono mentre l'app è chiusa (aggiornamento "Sempre"): stessa funzione, ma con il token del widget
-- invece della sessione (il portachiavi dell'app, a telefono bloccato, può non essere leggibile).
create or replace function public.widget_set_location(p_token text, p_lat_e2 int, p_lon_e2 int, p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid;
begin
  uid := public._token_user(p_token);
  if uid is null then return public._token_fail(); end if;
  return public._set_location(uid, p_lat_e2, p_lon_e2, p_at);
end $$;

-- ---------- Privilegi e RLS ----------
-- Consenso reciproco anche nel tempo reale: la riga dell'altra persona si vede solo se condividi anche tu.
create or replace function public.i_share_location() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sharing from public.locations where user_id = auth.uid()), false)
$$;
revoke all on function public.i_share_location() from public, anon;
grant execute on function public.i_share_location() to authenticated;
revoke all on public.notes, public.locations, public.widget_tokens from anon, authenticated;
grant select on public.notes, public.locations to authenticated;
alter table public.notes enable row level security;
alter table public.locations enable row level security;
alter table public.widget_tokens enable row level security;

drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations for select to authenticated
  using (couple_id = public.my_couple_id() and (user_id = auth.uid() or public.i_share_location()));
-- widget_tokens: nessuna policy, nessun privilegio (solo le funzioni security definer la toccano).

revoke all on function public._note_valid(text, jsonb) from public, anon, authenticated;
revoke all on function public._ms(timestamptz) from public, anon, authenticated;
revoke all on function public._note_json(public.notes, uuid) from public, anon, authenticated;
revoke all on function public._note_latest(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public._loc_state(uuid) from public, anon, authenticated;
revoke all on function public._set_location(uuid, int, int, bigint) from public, anon, authenticated;
revoke all on function public.tg_member_cleanup() from public, anon, authenticated;
revoke all on function public._token_user(text) from public, anon, authenticated;
revoke all on function public._token_fail() from public, anon, authenticated;
revoke all on function public.send_note(text, jsonb, text, bigint) from public, anon;
revoke all on function public.clear_note(uuid) from public, anon;
revoke all on function public.get_board() from public, anon;
revoke all on function public.set_location_sharing(boolean) from public, anon;
revoke all on function public.set_location(int, int, bigint) from public, anon;
revoke all on function public.rotate_widget_token() from public, anon;
revoke all on function public.widget_feed(text) from public;
revoke all on function public.widget_set_location(text, int, int, bigint) from public;
grant execute on function public.send_note(text, jsonb, text, bigint) to authenticated;
grant execute on function public.clear_note(uuid) to authenticated;
grant execute on function public.get_board() to authenticated;
grant execute on function public.set_location_sharing(boolean) to authenticated;
grant execute on function public.set_location(int, int, bigint) to authenticated;
grant execute on function public.rotate_widget_token() to authenticated;
-- Le due sole porte aperte al ruolo anon (chiave pubblica + token a 256 bit).
grant execute on function public.widget_feed(text) to anon, authenticated;
grant execute on function public.widget_set_location(text, int, int, bigint) to anon, authenticated;

-- ---------- Tempo reale ----------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['notes', 'locations'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
