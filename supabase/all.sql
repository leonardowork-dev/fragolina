-- Fragolina · TUTTO IL DATABASE IN UN FILE (generato da scripts/build-sql.mjs: non modificarlo a mano).
-- Incolla tutto nell'editor SQL di Supabase e premi Run. Si può rilanciare quante volte vuoi.

-- ===== 20261112000001_schema.sql =====
-- Fragolina · migrazione 1 · tabelle, vincoli, trigger.
-- Idempotente: si può rieseguire senza danni.

create extension if not exists pgcrypto with schema extensions;

-- Impostazioni interne (nessuna policy: nessun client le vede, solo le funzioni security definer).
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;

-- Registro dei tentativi (rate limit). Solo le funzioni lo toccano.
create table if not exists public.rate_events (
  id bigint generated always as identity primary key,
  kind text not null,
  user_id uuid,
  at timestamptz not null default now()
);
create index if not exists rate_events_kind_at_idx on public.rate_events (kind, at desc);
create index if not exists rate_events_user_idx on public.rate_events (user_id, kind, at desc);
alter table public.rate_events enable row level security;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  join_code text unique,
  join_code_expires_at timestamptz,
  relationship_start_date date,
  start_date_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- alfabeto senza caratteri ambigui: niente I, L, O, 0, 1
  constraint couples_join_code_format check (
    join_code is null or join_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'
  )
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 24),
  role text not null check (role in ('a', 'b')),
  joined_at timestamptz not null default now(),
  unique (couple_id, role)
);
create index if not exists couple_members_couple_idx on public.couple_members (couple_id);

create table if not exists public.mood_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mood_id text not null check (mood_id in
    ('felice','innamorata','stanca','affamata','stressata','triste','coccole','carica')),
  client_key text not null check (char_length(client_key) between 8 and 64),
  client_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index if not exists mood_events_couple_user_idx on public.mood_events (couple_id, user_id, created_at desc);

create table if not exists public.pings (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_key text not null check (char_length(client_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (from_user, client_key)
);
create index if not exists pings_couple_from_idx on public.pings (couple_id, from_user, created_at desc);

create table if not exists public.daily_answers (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  question_id text not null check (char_length(question_id) between 1 and 40),
  answer text not null check (answer in ('a', 'b')),
  answered_at timestamptz not null default now(),
  primary key (couple_id, user_id, day)
);

-- Massimo DUE membri per coppia (oltre al vincolo unique(couple_id, role) con role in a/b).
create or replace function public.tg_couple_members_max2() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.couple_members where couple_id = new.couple_id) >= 2 then
    raise exception 'couple_full' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists couple_members_max2 on public.couple_members;
create trigger couple_members_max2 before insert on public.couple_members
  for each row execute function public.tg_couple_members_max2();

-- Il timestamp scelto dal telefono non può stare nel futuro (fusi orari / orologio sballato).
create or replace function public.tg_mood_clamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.client_at := least(coalesce(new.client_at, now()), now());
  if (select count(*) from public.mood_events
        where user_id = new.user_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists mood_events_clamp on public.mood_events;
create trigger mood_events_clamp before insert on public.mood_events
  for each row execute function public.tg_mood_clamp();

-- Anti-spam: al massimo 30 "penso a te" al minuto per persona.
create or replace function public.tg_ping_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.pings
        where from_user = new.from_user and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pings_rate on public.pings;
create trigger pings_rate before insert on public.pings
  for each row execute function public.tg_ping_rate();


-- ===== 20261112000002_rls.sql =====
-- Fragolina · migrazione 2 · Row Level Security.
-- Regola unica: vedi e scrivi SOLO le righe della coppia di cui fai parte.

-- Funzioni d'appoggio (security definer: leggono couple_members senza ricorsione di policy).
create or replace function public.my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

create or replace function public.i_answered(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.daily_answers a where a.user_id = auth.uid() and a.day = p_day
  )
$$;

revoke all on function public.my_couple_id() from public, anon;
revoke all on function public.i_answered(date) from public, anon;
grant execute on function public.my_couple_id() to authenticated;
grant execute on function public.i_answered(date) to authenticated;

-- Privilegi di tabella: niente per anon, il minimo per authenticated.
revoke all on public.couples, public.couple_members, public.mood_events, public.pings,
  public.daily_answers, public.app_settings, public.rate_events from anon, authenticated;
grant select on public.couples, public.couple_members to authenticated;
grant select, insert on public.mood_events, public.pings to authenticated;
grant select, insert on public.daily_answers to authenticated;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.mood_events enable row level security;
alter table public.pings enable row level security;
alter table public.daily_answers enable row level security;

-- couples: sola lettura della propria coppia. Ogni modifica passa dalle RPC.
drop policy if exists couples_select on public.couples;
create policy couples_select on public.couples for select to authenticated
  using (id = public.my_couple_id());

-- couple_members: vedi te e il partner. Nessuna scrittura diretta (si entra solo con join_couple).
drop policy if exists members_select on public.couple_members;
create policy members_select on public.couple_members for select to authenticated
  using (couple_id = public.my_couple_id());

-- mood_events
drop policy if exists mood_select on public.mood_events;
create policy mood_select on public.mood_events for select to authenticated
  using (couple_id = public.my_couple_id());
drop policy if exists mood_insert on public.mood_events;
create policy mood_insert on public.mood_events for insert to authenticated
  with check (user_id = auth.uid() and couple_id = public.my_couple_id());

-- pings
drop policy if exists pings_select on public.pings;
create policy pings_select on public.pings for select to authenticated
  using (couple_id = public.my_couple_id());
drop policy if exists pings_insert on public.pings;
create policy pings_insert on public.pings for insert to authenticated
  with check (from_user = auth.uid() and couple_id = public.my_couple_id());

-- daily_answers: la risposta del partner si vede SOLO dopo aver risposto tu allo stesso giorno.
drop policy if exists answers_select on public.daily_answers;
create policy answers_select on public.daily_answers for select to authenticated
  using (
    couple_id = public.my_couple_id()
    and (user_id = auth.uid() or public.i_answered(day))
  );
drop policy if exists answers_insert on public.daily_answers;
create policy answers_insert on public.daily_answers for insert to authenticated
  with check (
    user_id = auth.uid()
    and couple_id = public.my_couple_id()
    and day between current_date - 2 and current_date + 2
  );


-- ===== 20261112000003_rpcs.sql =====
-- Fragolina · migrazione 3 · funzioni (RPC). Tutte security definer con search_path fissato.
-- Convenzione: restituiscono jsonb { ok: true, ... } oppure { ok: false, error: '<codice>' }.
-- Gli errori NON sono eccezioni, così il registro dei tentativi falliti non viene annullato dal rollback.
-- Codici: not_authenticated, name_required, already_paired, not_paired, closed, rate_limited,
--         invalid_code, code_expired, couple_full, no_partner.

-- Codice d'invito: 6 caratteri da un alfabeto senza I, L, O, 0, 1 (31 simboli, ~887 milioni di codici).
create or replace function public.gen_join_code() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := gen_random_bytes(6);
  out text := '';
begin
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return out;
end $$;

-- Assegna un codice nuovo (valido 24 ore) alla coppia e lo restituisce.
create or replace function public._fresh_code(p_couple uuid) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare code text; tries int := 0;
begin
  loop
    tries := tries + 1;
    code := public.gen_join_code();
    begin
      update public.couples
         set join_code = code, join_code_expires_at = now() + interval '24 hours'
       where id = p_couple;
      return code;
    exception when unique_violation then
      if tries > 12 then raise; end if;
    end;
  end loop;
end $$;

create or replace function public._clean_name(p text) returns text
language sql immutable as $$ select left(btrim(coalesce(p, '')), 24) $$;

-- create_couple: la persona A crea il posto e riceve il codice.
create or replace function public.create_couple(p_display_name text, p_start_date date default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  nm text := public._clean_name(p_display_name);
  cid uuid;
  code text;
  exp timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if exists (select 1 from public.couple_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'already_paired');
  end if;
  if coalesce((select value from public.app_settings where key = 'closed'), 'false') = 'true' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  -- pulizia pigra
  delete from public.rate_events where at < now() - interval '2 days';
  delete from public.couples c
   where c.join_code_expires_at < now() - interval '7 days'
     and (select count(*) from public.couple_members m where m.couple_id = c.id) <= 1;
  -- rate limit: 3 per persona al giorno, 20 in tutto all'ora
  if (select count(*) from public.rate_events where kind = 'create' and user_id = uid
        and at > now() - interval '1 day') >= 3
     or (select count(*) from public.rate_events where kind = 'create'
        and at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events(kind, user_id) values ('create', uid);

  insert into public.couples (relationship_start_date) values (p_start_date) returning id into cid;
  insert into public.couple_members (couple_id, user_id, display_name, role) values (cid, uid, nm, 'a');
  code := public._fresh_code(cid);
  select join_code_expires_at into exp from public.couples where id = cid;
  return jsonb_build_object('ok', true, 'couple_id', cid, 'code', code, 'expires_at', exp, 'role', 'a');
end $$;

-- join_couple: la persona B entra con il codice. Massimo 5 errori ogni 10 minuti per persona, 60 in tutto.
create or replace function public.join_couple(p_code text, p_display_name text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  nm text := public._clean_name(p_display_name);
  cd text := upper(btrim(coalesce(p_code, '')));
  c public.couples;
  members int;
  newrole text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  if exists (select 1 from public.couple_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'already_paired');
  end if;
  if (select count(*) from public.rate_events where kind = 'join_fail' and user_id = uid
        and at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.rate_events where kind = 'join_fail'
        and at > now() - interval '10 minutes') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  if cd !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$' then
    insert into public.rate_events(kind, user_id) values ('join_fail', uid);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into c from public.couples where join_code = cd for update;
  if not found then
    insert into public.rate_events(kind, user_id) values ('join_fail', uid);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select count(*) into members from public.couple_members where couple_id = c.id;
  if members >= 2 then
    insert into public.rate_events(kind, user_id) values ('join_fail', uid);
    return jsonb_build_object('ok', false, 'error', 'couple_full');
  end if;
  if c.join_code_expires_at is not null and c.join_code_expires_at < now() then
    insert into public.rate_events(kind, user_id) values ('join_fail', uid);
    return jsonb_build_object('ok', false, 'error', 'code_expired');
  end if;

  select case when exists (select 1 from public.couple_members where couple_id = c.id and role = 'a')
              then 'b' else 'a' end into newrole;
  insert into public.couple_members (couple_id, user_id, display_name, role)
  values (c.id, uid, nm, newrole);
  -- Codice usato: non più valido per nessun altro.
  update public.couples set join_code_expires_at = now() where id = c.id;
  return jsonb_build_object('ok', true, 'couple_id', c.id, 'role', newrole);
end $$;

-- renew_join_code: codice scaduto? Chi è solo nella coppia ne chiede uno nuovo.
create or replace function public.renew_join_code() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid; code text; exp timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if (select count(*) from public.couple_members where couple_id = cid) >= 2 then
    return jsonb_build_object('ok', false, 'error', 'couple_full');
  end if;
  code := public._fresh_code(cid);
  select join_code_expires_at into exp from public.couples where id = cid;
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);
end $$;

-- leave_couple: esci. Se resta l'altra persona, riceve un codice nuovo per ricollegarsi.
create or replace function public.leave_couple() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', true); end if; -- già fuori
  delete from public.couple_members where user_id = uid;
  if (select count(*) from public.couple_members where couple_id = cid) = 0 then
    delete from public.couples where id = cid; -- a cascata spariscono umori, pensieri e risposte
  else
    perform public._fresh_code(cid);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- release_partner: "ha cambiato telefono": libera il posto dell'altra persona (che dovrà rientrare con un codice nuovo).
create or replace function public.release_partner() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid; code text; exp timestamptz; n int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  delete from public.couple_members where couple_id = cid and user_id <> uid;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;
  code := public._fresh_code(cid);
  select join_code_expires_at into exp from public.couples where id = cid;
  return jsonb_build_object('ok', true, 'code', code, 'expires_at', exp);
end $$;

-- set_start_date: vince l'ultima modifica (last-write-wins). L'orario del telefono non può stare nel futuro.
create or replace function public.set_start_date(p_date date, p_client_at timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid; ts timestamptz; c public.couples;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_date is null or p_date > current_date + 1 or p_date < date '1990-01-01' then
    return jsonb_build_object('ok', false, 'error', 'invalid_date');
  end if;
  ts := least(coalesce(p_client_at, now()), now());
  update public.couples
     set relationship_start_date = p_date, start_date_updated_at = ts
   where id = cid and (relationship_start_date is null or ts >= start_date_updated_at);
  select * into c from public.couples where id = cid;
  return jsonb_build_object('ok', true, 'start_date', c.relationship_start_date,
                            'updated_at', c.start_date_updated_at);
end $$;

create or replace function public.set_display_name(p_name text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); nm text := public._clean_name(p_name);
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  update public.couple_members set display_name = nm where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- get_state: fotografia completa in un solo viaggio. Applica a mano la regola "risposta del partner
-- visibile solo dopo la tua" (la funzione bypassa la RLS).
create or replace function public.get_state(p_day date, p_day_start timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  c public.couples;
  mine jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', true, 'paired', false, 'user_id', uid); end if;
  select * into c from public.couples where id = cid;

  select jsonb_build_object('question_id', a.question_id, 'answer', a.answer, 'at', a.answered_at)
    into mine from public.daily_answers a where a.couple_id = cid and a.user_id = uid and a.day = p_day;

  return jsonb_build_object(
    'ok', true, 'paired', true, 'user_id', uid,
    'couple', jsonb_build_object(
      'id', c.id, 'join_code', c.join_code, 'join_code_expires_at', c.join_code_expires_at,
      'start_date', c.relationship_start_date, 'start_date_updated_at', c.start_date_updated_at),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'display_name', m.display_name, 'role', m.role) order by m.role), '[]'::jsonb)
      from public.couple_members m where m.couple_id = cid),
    'my_mood', (select jsonb_build_object('mood_id', e.mood_id, 'at', coalesce(e.client_at, e.created_at))
      from public.mood_events e where e.couple_id = cid and e.user_id = uid
      order by coalesce(e.client_at, e.created_at) desc limit 1),
    'partner_mood', (select jsonb_build_object('mood_id', e.mood_id, 'at', coalesce(e.client_at, e.created_at))
      from public.mood_events e where e.couple_id = cid and e.user_id <> uid
      order by coalesce(e.client_at, e.created_at) desc limit 1),
    'pings_sent_today', (select count(*) from public.pings p
      where p.couple_id = cid and p.from_user = uid and p.created_at >= p_day_start),
    'pings_received_total', (select count(*) from public.pings p
      where p.couple_id = cid and p.from_user <> uid),
    'last_ping_received_at', (select max(p.created_at) from public.pings p
      where p.couple_id = cid and p.from_user <> uid),
    'last_ping_sent_at', (select max(p.created_at) from public.pings p
      where p.couple_id = cid and p.from_user = uid),
    'my_answer', mine,
    'partner_answer', case when mine is null then null else (
      select jsonb_build_object('question_id', a.question_id, 'answer', a.answer, 'at', a.answered_at)
        from public.daily_answers a where a.couple_id = cid and a.user_id <> uid and a.day = p_day) end
  );
end $$;

-- Permessi: solo utenti con sessione (anche anonima). Chi ha solo la chiave pubblica e nessuna sessione non può nulla.
revoke all on function public.gen_join_code() from public, anon, authenticated;
revoke all on function public._fresh_code(uuid) from public, anon, authenticated;
revoke all on function public._clean_name(text) from public, anon, authenticated;
revoke all on function public.create_couple(text, date) from public, anon;
revoke all on function public.join_couple(text, text) from public, anon;
revoke all on function public.renew_join_code() from public, anon;
revoke all on function public.leave_couple() from public, anon;
revoke all on function public.release_partner() from public, anon;
revoke all on function public.set_start_date(date, timestamptz) from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
revoke all on function public.get_state(date, timestamptz) from public, anon;
grant execute on function public.create_couple(text, date) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
grant execute on function public.renew_join_code() to authenticated;
grant execute on function public.leave_couple() to authenticated;
grant execute on function public.release_partner() to authenticated;
grant execute on function public.set_start_date(date, timestamptz) to authenticated;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.get_state(date, timestamptz) to authenticated;


-- ===== 20261112000004_realtime.sql =====
-- Fragolina · migrazione 4 · Realtime (publication supabase_realtime).
-- Oltre a pings, mood_events, daily_answers e couples c'è couple_members: serve alla persona A
-- per accorgersi nell'istante in cui B entra con il codice.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['pings', 'mood_events', 'daily_answers', 'couples', 'couple_members'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ===== 20261113000001_pet.sql =====
-- Fragolina · migrazione 5 · il pet condiviso (sessione 4).
-- Idempotente: si può rieseguire senza danni. NON tocca nulla delle migrazioni 1-4.
--
-- Il pet è UNA riga per coppia (public.pets) + un registro append-only delle cure (public.pet_actions).
-- Nessun timer sul server: i tre bisogni (pancia, coccole, energia) sono salvati come (valore, istante `at`) e
-- decadono col tempo; il valore di adesso lo calcola chi legge (app e widget) con le stesse regole di
-- src/lib/pet/rules.ts. Tutto in INTERI (bisogni 0-1000, tempi in millisecondi) per avere gli stessi risultati ovunque.
-- Si scrive SOLO con le funzioni pet_act / set_pet_name: nessuna scrittura diretta dai telefoni.

create table if not exists public.pets (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  rev bigint not null default 0,
  hatched_at bigint,
  hatched_by uuid,
  touches_a int not null default 0 check (touches_a >= 0),
  touches_b int not null default 0 check (touches_b >= 0),
  name text check (name is null or char_length(btrim(name)) between 1 and 16),
  name_at bigint not null default 0,
  food int not null default 800 check (food between 0 and 1000),
  love int not null default 800 check (love between 0 and 1000),
  energy int not null default 800 check (energy between 0 and 1000),
  at bigint not null default 0,
  sleep_until bigint not null default 0,
  last_at bigint not null default 0,
  care_days int not null default 0 check (care_days >= 0),
  both_days int not null default 0 check (both_days >= 0),
  day text check (day is null or day ~ '^\d{4}-\d{2}-\d{2}$'),
  day_a boolean not null default false,
  day_b boolean not null default false,
  last_by uuid,
  last_kind text check (last_kind is null or last_kind in ('touch','feed','cuddle','play','sleep','hatch','name')),
  last_item text check (last_item is null or last_item in ('mora','lampone','mirtillo','pesca')),
  last_key text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_actions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('touch','feed','cuddle','play','sleep','hatch','name')),
  item text check (item is null or item in ('mora','lampone','mirtillo','pesca')),
  amount int not null default 1,
  at bigint not null,
  rev bigint not null,
  client_key text not null check (char_length(client_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index if not exists pet_actions_couple_rev_idx on public.pet_actions (couple_id, rev desc);
create index if not exists pet_actions_user_kind_idx on public.pet_actions (user_id, kind, at desc);
create index if not exists pet_actions_user_created_idx on public.pet_actions (user_id, created_at desc);

-- ---------- Regole (interi). Specchio di src/lib/pet/rules.ts ----------

-- Un bisogno dopo dt millisecondi: perde `rate` unità l'ora (parte intera), mai sotto 0.
create or replace function public._pet_decay(v int, rate int, dt bigint) returns int
language sql immutable as $$
  select greatest(0, least(1000, v - (rate::bigint * greatest(dt, 0)) / 3600000))::int
$$;

-- Registra il giorno di cura: +1 giorno di cura al primo gesto del giorno, +1 "in due" quando agiscono entrambi.
create or replace function public._pet_register_day(p public.pets, p_role text, p_day text) returns public.pets
language plpgsql immutable as $$
declare r public.pets := p;
begin
  if r.day is null or p_day > r.day then
    r.care_days := r.care_days + 1;
    r.day := p_day;
    r.day_a := (p_role = 'a');
    r.day_b := (p_role = 'b');
  elsif p_day = r.day then
    if p_role = 'a' and not r.day_a then
      r.day_a := true;
      if r.day_b then r.both_days := r.both_days + 1; end if;
    elsif p_role = 'b' and not r.day_b then
      r.day_b := true;
      if r.day_a then r.both_days := r.both_days + 1; end if;
    end if;
  end if;
  return r;
end $$;

-- Un passo: applica un'azione e restituisce la riga nuova. Se rev non cambia l'azione è stata ignorata.
-- (La validità di kind/item e l'uovo ancora chiuso li controlla pet_act prima.)
create or replace function public._pet_step(
  p public.pets, p_kind text, p_item text, p_amount int, p_role text, p_user uuid,
  p_at bigint, p_day text, p_key text
) returns public.pets
language plpgsql immutable as $$
declare
  r public.pets := p;
  t bigint := greatest(p_at, p.at);
  n int;
  f int; l int; e int;
begin
  if p_kind = 'touch' then
    if r.hatched_at is not null then return r; end if;
    n := least(greatest(coalesce(p_amount, 1), 1), 10);
    r.rev := r.rev + 1;
    if p_role = 'a' then r.touches_a := r.touches_a + n; else r.touches_b := r.touches_b + n; end if;
    r.last_key := p_key;
    if (r.touches_a >= 1 and r.touches_b >= 1) or r.touches_a + r.touches_b >= 40 then
      r.hatched_at := t;
      r.hatched_by := p_user;
      r.food := 800; r.love := 800; r.energy := 800;
      r.at := t;
      r.sleep_until := 0;
      r.last_at := t;
      r.last_by := p_user;
      r.last_kind := 'hatch';
      r.last_item := null;
      r := public._pet_register_day(r, p_role, p_day);
    end if;
    return r;
  end if;

  f := public._pet_decay(p.food, 45, t - p.at);
  l := public._pet_decay(p.love, 30, t - p.at);
  e := public._pet_decay(p.energy, 20, t - p.at);
  r.sleep_until := 0;
  if p_kind = 'feed' then
    case p_item
      when 'mora' then f := f + 300;
      when 'lampone' then f := f + 250; l := l + 50;
      when 'mirtillo' then f := f + 200; e := e + 100;
      when 'pesca' then f := f + 400;
    end case;
  elsif p_kind = 'cuddle' then
    l := l + 250;
  elsif p_kind = 'play' then
    l := l + 150; e := e - 100;
  elsif p_kind = 'sleep' then
    e := e + 500;
    r.sleep_until := t + 5400000;
  end if;
  r.food := greatest(0, least(1000, f));
  r.love := greatest(0, least(1000, l));
  r.energy := greatest(0, least(1000, e));
  r.at := t;
  r.last_at := t;
  r.last_by := p_user;
  r.last_kind := p_kind;
  r.last_item := case when p_kind = 'feed' then p_item else null end;
  r.last_key := p_key;
  r.rev := r.rev + 1;
  r := public._pet_register_day(r, p_role, p_day);
  return r;
end $$;

-- La riga come JSON per l'app (chiavi in snake_case, tempi in millisecondi).
create or replace function public._pet_json(p public.pets) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'rev', p.rev, 'hatched_at', p.hatched_at, 'hatched_by', p.hatched_by,
    'touches_a', p.touches_a, 'touches_b', p.touches_b,
    'name', p.name, 'name_at', p.name_at,
    'food', p.food, 'love', p.love, 'energy', p.energy, 'at', p.at,
    'sleep_until', p.sleep_until, 'last_at', p.last_at,
    'care_days', p.care_days, 'both_days', p.both_days,
    'day', p.day, 'day_a', p.day_a, 'day_b', p.day_b,
    'last_by', p.last_by, 'last_kind', p.last_kind, 'last_item', p.last_item, 'last_key', p.last_key)
$$;

create or replace function public._now_ms() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- ---------- Funzioni per i telefoni ----------

-- pet_act: una cura. Idempotente per chiave (la coda offline può ripetere), pausa minima per persona e azione.
create or replace function public.pet_act(
  p_kind text, p_item text, p_amount int, p_day date, p_client_key text, p_client_at bigint
) returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid();
  cid uuid; myrole text;
  nowms bigint := public._now_ms();
  t bigint;
  d text;
  pr public.pets; nw public.pets;
  dup public.pet_actions;
  last_same bigint;
  cd bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_kind is null or p_kind not in ('touch','feed','cuddle','play','sleep')
     or p_client_key is null or char_length(p_client_key) not between 8 and 64
     or (p_kind = 'feed' and (p_item is null or p_item not in ('mora','lampone','mirtillo','pesca'))) then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;
  select couple_id, role into cid, myrole from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;

  -- già fatta (stessa chiave): non si ripete
  select * into dup from public.pet_actions where user_id = uid and client_key = p_client_key;
  if found then
    select * into pr from public.pets where couple_id = cid;
    return jsonb_build_object('ok', true, 'duplicate', true, 'pet', case when pr.couple_id is null then null else public._pet_json(pr) end);
  end if;

  if (select count(*) from public.pet_actions where user_id = uid and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into public.pets (couple_id) values (cid) on conflict (couple_id) do nothing;
  select * into pr from public.pets where couple_id = cid for update;

  -- orario del telefono: mai nel futuro, mai più vecchio di 48 ore
  t := greatest(least(coalesce(p_client_at, nowms), nowms), nowms - 172800000);
  d := to_char(case when p_day is null or abs(p_day - current_date) > 2 then current_date else p_day end, 'YYYY-MM-DD');

  if p_kind <> 'touch' and pr.hatched_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_hatched');
  end if;

  cd := case p_kind when 'feed' then 45000 when 'cuddle' then 20000 when 'play' then 30000 when 'sleep' then 120000 else 0 end;
  if cd > 0 then
    select max(at) into last_same from public.pet_actions where user_id = uid and kind = p_kind;
    if last_same is not null and t - last_same < cd then
      return jsonb_build_object('ok', false, 'error', 'cooldown');
    end if;
  end if;

  nw := public._pet_step(pr, p_kind, p_item, p_amount, myrole, uid, t, d, p_client_key);
  if nw.rev = pr.rev then
    return jsonb_build_object('ok', true, 'ignored', true, 'pet', public._pet_json(pr));
  end if;

  update public.pets set
    rev = nw.rev, hatched_at = nw.hatched_at, hatched_by = nw.hatched_by,
    touches_a = nw.touches_a, touches_b = nw.touches_b,
    food = nw.food, love = nw.love, energy = nw.energy, at = nw.at,
    sleep_until = nw.sleep_until, last_at = nw.last_at,
    care_days = nw.care_days, both_days = nw.both_days,
    day = nw.day, day_a = nw.day_a, day_b = nw.day_b,
    last_by = nw.last_by, last_kind = nw.last_kind, last_item = nw.last_item, last_key = nw.last_key,
    updated_at = now()
  where couple_id = cid;

  insert into public.pet_actions (couple_id, user_id, kind, item, amount, at, rev, client_key)
  values (cid, uid, case when nw.last_kind = 'hatch' then 'hatch' else p_kind end,
          case when p_kind = 'feed' then p_item else null end,
          case when p_kind = 'touch' then least(greatest(coalesce(p_amount, 1), 1), 10) else 1 end,
          t, nw.rev, p_client_key);

  -- pulizia pigra del registro: tengo gli ultimi 200 movimenti
  delete from public.pet_actions where couple_id = cid and rev < nw.rev - 200;

  return jsonb_build_object('ok', true, 'pet', public._pet_json(nw));
end $$;

-- set_pet_name: il nome (max 16). Vince l'ultima modifica (last-write-wins). Solo a pet schiuso.
create or replace function public.set_pet_name(p_name text, p_client_at bigint, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid(); cid uuid;
  nm text := left(btrim(coalesce(p_name, '')), 16);
  nowms bigint := public._now_ms();
  t bigint;
  pr public.pets;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if nm = '' then return jsonb_build_object('ok', false, 'error', 'name_required'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into pr from public.pets where couple_id = cid for update;
  if not found or pr.hatched_at is null then return jsonb_build_object('ok', false, 'error', 'not_hatched'); end if;
  t := greatest(least(coalesce(p_client_at, nowms), nowms), nowms - 172800000);
  if pr.name is null or t >= pr.name_at then
    update public.pets set name = nm, name_at = t, rev = rev + 1, last_by = uid, last_kind = 'name',
           last_item = null, last_key = p_client_key, updated_at = now()
     where couple_id = cid returning * into pr;
  end if;
  return jsonb_build_object('ok', true, 'pet', public._pet_json(pr));
end $$;

-- get_pet: lo stato, il registro delle ultime cure e le mie ultime volte (per le pause).
create or replace function public.get_pet(p_limit int default 12)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); cid uuid; pr public.pets;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into pr from public.pets where couple_id = cid;
  return jsonb_build_object(
    'ok', true,
    'pet', case when pr.couple_id is null then null else public._pet_json(pr) end,
    'log', (select coalesce(jsonb_agg(jsonb_build_object(
              'rev', a.rev, 'key', a.client_key, 'user_id', a.user_id, 'kind', a.kind, 'item', a.item, 'at', a.at)
            order by a.rev desc), '[]'::jsonb)
            from (select * from public.pet_actions where couple_id = cid order by rev desc limit least(greatest(p_limit, 1), 30)) a),
    'my_last', (select coalesce(jsonb_object_agg(k.kind, k.at), '{}'::jsonb)
                from (select kind, max(at) as at from public.pet_actions where user_id = uid group by kind) k)
  );
end $$;

-- ---------- Permessi e RLS ----------
revoke all on public.pets, public.pet_actions from anon, authenticated;
grant select on public.pets, public.pet_actions to authenticated;
alter table public.pets enable row level security;
alter table public.pet_actions enable row level security;

drop policy if exists pets_select on public.pets;
create policy pets_select on public.pets for select to authenticated
  using (couple_id = public.my_couple_id());
drop policy if exists pet_actions_select on public.pet_actions;
create policy pet_actions_select on public.pet_actions for select to authenticated
  using (couple_id = public.my_couple_id());

revoke all on function public._pet_decay(int, int, bigint) from public, anon, authenticated;
revoke all on function public._pet_register_day(public.pets, text, text) from public, anon, authenticated;
revoke all on function public._pet_step(public.pets, text, text, int, text, uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public._pet_json(public.pets) from public, anon, authenticated;
revoke all on function public._now_ms() from public, anon, authenticated;
revoke all on function public.pet_act(text, text, int, date, text, bigint) from public, anon;
revoke all on function public.set_pet_name(text, bigint, text) from public, anon;
revoke all on function public.get_pet(int) from public, anon;
grant execute on function public.pet_act(text, text, int, date, text, bigint) to authenticated;
grant execute on function public.set_pet_name(text, bigint, text) to authenticated;
grant execute on function public.get_pet(int) to authenticated;

-- ---------- Tempo reale ----------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pets'
  ) then
    alter publication supabase_realtime add table public.pets;
  end if;
end $$;


-- ===== 20261114000001_note.sql =====
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


-- ===== 20261115000001_giochi.sql =====
-- Fragolina · migrazione 7 · mini giochi a due (sessione 6): Tris della fragola, Quanto mi conosci?, Disegna e indovina.
-- Idempotente: si può rieseguire senza danni. NON tocca nulla delle migrazioni 1-6.
--
--  • games         la partita (stato PUBBLICO calcolato dal server). Una sola aperta per gioco e per coppia.
--  • game_moves    le mosse, solo aggiunta (le risposte segrete del quiz NON ci sono).
--  • game_secrets  i segreti: risposte del quiz finché non hanno risposto entrambi, parola da disegnare. NESSUN client
--                  la legge e non è nel tempo reale: si rivelano solo dentro `games.data`, quando è il momento.
--  • game_scores   "Leonardo 7 – Nikole 9". • game_decks  quali domande/parole sono già uscite (mai ripetute).
-- Si scrive SOLO con le funzioni (start_game, game_move, abandon_game): nessuna scrittura diretta dai telefoni.
-- Le regole sono lo specchio di src/lib/games/reducer.ts (parità provata in tests/games.test.ts + sql-check).

create table if not exists public.games (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('tris', 'quiz', 'draw')),
  status text not null default 'open' check (status in ('open', 'done', 'abandoned')),
  turn uuid,
  rev int not null default 1,
  data jsonb not null,
  result jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists games_one_open_idx on public.games (couple_id, kind) where status = 'open';
create index if not exists games_couple_created_idx on public.games (couple_id, created_at desc);

create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  client_key text not null check (char_length(client_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index if not exists game_moves_game_idx on public.game_moves (game_id, seq);
create index if not exists game_moves_user_idx on public.game_moves (user_id, created_at desc);

create table if not exists public.game_secrets (
  game_id uuid not null references public.games(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (game_id, key)
);

create table if not exists public.game_scores (
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('tris', 'quiz', 'draw')),
  user_id uuid not null,
  wins int not null default 0,
  draws int not null default 0,
  played int not null default 0,
  primary key (couple_id, kind, user_id)
);

create table if not exists public.game_decks (
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('quiz', 'draw')),
  used int[] not null default '{}',
  primary key (couple_id, kind)
);

-- ---------- Parole (specchio di src/lib/games/words.ts) ----------
create or replace function public._norm_word(t text) returns text
language plpgsql immutable as $$
declare s text := coalesce(t, '');
begin
  s := lower(translate(s, 'àáâäèéêëìíîïòóôöùúûüçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑ', 'aaaaeeeeiiiioooouuuucnaaaaeeeeiiiioooouuuucn'));
  s := regexp_replace(s, '[^a-z]+', ' ', 'g');
  s := btrim(s);
  s := regexp_replace(s, ' +', ' ', 'g');
  s := regexp_replace(s, '^(il|lo|la|le|i|gli|l|un|uno|una) (?=.)', '');
  return replace(s, ' ', '');
end $$;

create or replace function public._same_word(a text, b text) returns boolean
language plpgsql immutable as $$
declare x text := public._norm_word(a); y text := public._norm_word(b);
begin
  if x = '' or y = '' then return false; end if;
  if x = y then return true; end if;
  return char_length(x) >= 4 and char_length(y) >= 4
     and left(x, char_length(x) - 1) = left(y, char_length(y) - 1);
end $$;

-- ---------- Tris ----------
create or replace function public._tris_line(board text) returns int[]
language plpgsql immutable as $$
declare lines int[] := array[0,1,2, 3,4,5, 6,7,8, 0,3,6, 1,4,7, 2,5,8, 0,4,8, 2,4,6]; i int; a int; b int; c int; m text;
begin
  for i in 0..7 loop
    a := lines[i*3+1]; b := lines[i*3+2]; c := lines[i*3+3];
    m := substr(board, a + 1, 1);
    if m <> '-' and m = substr(board, b + 1, 1) and m = substr(board, c + 1, 1) then return array[a, b, c]; end if;
  end loop;
  return null;
end $$;

create or replace function public._ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function public._game_json(g public.games) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', g.id, 'kind', g.kind, 'status', g.status, 'turn', g.turn, 'rev', g.rev, 'data', g.data, 'result', g.result,
    'createdBy', g.created_by, 'createdAt', public._ms(g.created_at), 'updatedAt', public._ms(g.updated_at),
    'finishedAt', case when g.finished_at is null then null else public._ms(g.finished_at) end)
$$;

-- ---------- Applicazione di una mossa (specchio di applyMove in reducer.ts). Restituisce data/turn/status/result ----------
create or replace function public._game_apply(g public.games, uid uuid, other uuid, mv jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  d jsonb := g.data; t text := mv->>'type';
  cell int; board text; mark text; line int[]; x uuid; o uuid;
  q int; idx int; role text; sS int; sG int; ok boolean; k int; allrev boolean; sc int;
  word text; txt text; gs jsonb; nxt text;
begin
  if g.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'game_over'); end if;

  if g.kind = 'tris' and t = 'place' then
    if g.turn is distinct from uid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if jsonb_typeof(mv->'cell') <> 'number' or (mv->>'cell') !~ '^[0-8]$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    cell := (mv->>'cell')::int; board := d->>'board';
    if substr(board, cell + 1, 1) <> '-' then return jsonb_build_object('ok', false, 'error', 'cell_taken'); end if;
    x := (d->>'x')::uuid; o := (d->>'o')::uuid;
    mark := case when uid = x then 'X' else 'O' end;
    board := substr(board, 1, cell) || mark || substr(board, cell + 2);
    d := jsonb_set(d, '{board}', to_jsonb(board));
    line := public._tris_line(board);
    if line is not null then
      d := jsonb_set(d, '{win}', to_jsonb(line));
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done', 'result', jsonb_build_object('winner', uid));
    elsif position('-' in board) = 0 then
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done', 'result', jsonb_build_object('winner', null));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', case when uid = x then o else x end, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'quiz' and t = 'answer' then
    if jsonb_typeof(mv->'q') <> 'number' or (mv->>'q') !~ '^[0-4]$' or jsonb_typeof(mv->'idx') <> 'number' or (mv->>'idx') !~ '^[0-9]$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    q := (mv->>'q')::int; idx := (mv->>'idx')::int;
    role := case when (d->'subjects'->>q)::uuid = uid then 's' else 'g' end;
    if (d->'answered'->q->>role)::boolean then return jsonb_build_object('ok', false, 'error', 'already_answered'); end if;
    d := jsonb_set(d, array['answered', q::text, role], 'true'::jsonb);
    insert into public.game_secrets (game_id, key, value) values (g.id, 'q' || q || role, idx::text)
      on conflict (game_id, key) do nothing;
    if (d->'answered'->q->>'s')::boolean and (d->'answered'->q->>'g')::boolean then
      select value::int into sS from public.game_secrets where game_id = g.id and key = 'q' || q || 's';
      select value::int into sG from public.game_secrets where game_id = g.id and key = 'q' || q || 'g';
      ok := sS = sG;
      d := jsonb_set(d, array['reveals', q::text], jsonb_build_object('s', sS, 'g', sG, 'ok', ok));
      if ok then d := jsonb_set(d, '{score}', to_jsonb((d->>'score')::int + 1)); end if;
    end if;
    allrev := true;
    for k in 0..4 loop
      if jsonb_typeof(d->'reveals'->k) <> 'object' then allrev := false; end if;
    end loop;
    if allrev then
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done',
        'result', jsonb_build_object('score', (d->>'score')::int, 'total', 5));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'draw' and t = 'drawing' then
    if uid <> (d->>'drawer')::uuid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if d->>'phase' <> 'drawing' then return jsonb_build_object('ok', false, 'error', 'wrong_phase'); end if;
    if not public._note_valid('draw', mv->'content') then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
    d := jsonb_set(jsonb_set(d, '{drawing}', mv->'content'), '{phase}', '"guessing"'::jsonb);
    return jsonb_build_object('ok', true, 'data', d, 'turn', (d->>'guesser')::uuid, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'draw' and t = 'guess' then
    if uid <> (d->>'guesser')::uuid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if d->>'phase' <> 'guessing' then return jsonb_build_object('ok', false, 'error', 'wrong_phase'); end if;
    txt := btrim(coalesce(mv->>'text', ''));
    if jsonb_typeof(mv->'text') <> 'string' or char_length(txt) < 1 or char_length(txt) > 40 then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    select value into word from public.game_secrets where game_id = g.id and key = 'word';
    ok := public._same_word(txt, coalesce(word, ''));
    d := jsonb_set(d, '{guesses}', (d->'guesses') || jsonb_build_array(jsonb_build_object('by', uid, 'text', txt, 'ok', ok)));
    if ok or jsonb_array_length(d->'guesses') >= 3 then
      d := jsonb_set(jsonb_set(d, '{phase}', '"done"'::jsonb), '{word}', to_jsonb(coalesce(word, '')));
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done',
        'result', jsonb_build_object('solved', ok, 'attempts', jsonb_array_length(d->'guesses'), 'word', coalesce(word, '')));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', (d->>'guesser')::uuid, 'status', 'open', 'result', null);
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_move');
end $$;

-- Punteggi a fine partita (specchio di scoreDelta in reducer.ts).
create or replace function public._game_score(g public.games, a uuid, b uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare u uuid; w int := 0; dr int := 0; pl int := 1; winner uuid;
begin
  if g.status <> 'done' then return; end if;
  foreach u in array array[a, b] loop
    w := 0; dr := 0; pl := 1;
    if g.kind = 'tris' then
      winner := nullif(g.result->>'winner', '')::uuid;
      if winner is null then dr := 1; elsif winner = u then w := 1; end if;
    elsif g.kind = 'quiz' then
      w := (g.result->>'score')::int; pl := 5;
    else
      if (g.result->>'solved')::boolean then w := 1; end if;
    end if;
    insert into public.game_scores (couple_id, kind, user_id, wins, draws, played) values (g.couple_id, g.kind, u, w, dr, pl)
    on conflict (couple_id, kind, user_id) do update set
      wins = public.game_scores.wins + excluded.wins, draws = public.game_scores.draws + excluded.draws,
      played = public.game_scores.played + excluded.played;
  end loop;
end $$;

-- ---------- RPC ----------
create or replace function public.start_game(p_id uuid, p_kind text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); cid uuid; other uuid; ex public.games; last public.games; g public.games;
  d jsonb; turn uuid; first uuid; second uuid; x uuid; o uuid; word text; qids jsonb; i int; reset boolean;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_id is null or p_kind is null or p_kind not in ('tris', 'quiz', 'draw') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  if other is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;

  select * into ex from public.games where id = p_id;
  if found then
    if ex.couple_id <> cid then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(ex));
  end if;
  select * into ex from public.games where couple_id = cid and kind = p_kind and status = 'open';
  if found then return jsonb_build_object('ok', false, 'error', 'game_open', 'game', public._game_json(ex)); end if;
  if (select count(*) from public.game_moves where user_id = uid and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  select * into last from public.games where couple_id = cid and kind = p_kind order by created_at desc limit 1;
  p_params := coalesce(p_params, '{}'::jsonb);

  if p_kind = 'tris' then
    x := case when not found or last.id is null then uid when (last.data->>'x')::uuid = uid then other else uid end;
    o := case when x = uid then other else uid end;
    d := jsonb_build_object('x', x, 'o', o, 'board', '---------', 'win', null);
    turn := x;
  elsif p_kind = 'quiz' then
    qids := p_params->'qids';
    if jsonb_typeof(qids) <> 'array' or jsonb_array_length(qids) <> 5 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    for i in 0..4 loop
      if jsonb_typeof(qids->i) <> 'number' or (qids->>i) !~ '^[0-9]{1,3}$' then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    end loop;
    if (select count(distinct v) from jsonb_array_elements_text(qids) v) <> 5 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    first := case when last.id is null then uid when (last.data->'subjects'->>0)::uuid = uid then other else uid end;
    second := case when first = uid then other else uid end;
    d := jsonb_build_object('qids', qids,
      'subjects', jsonb_build_array(first, second, first, second, first),
      'answered', jsonb_build_array(jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false),
        jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false)),
      'reveals', jsonb_build_array(null, null, null, null, null), 'score', 0);
    turn := null;
  else
    word := btrim(coalesce(p_params->>'word', ''));
    if char_length(word) < 2 or char_length(word) > 40 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    d := jsonb_build_object('drawer', uid, 'guesser', other, 'phase', 'drawing', 'drawing', null, 'guesses', '[]'::jsonb, 'word', null);
    turn := uid;
  end if;

  insert into public.games (id, couple_id, kind, turn, data, created_by) values (p_id, cid, p_kind, turn, d, uid) returning * into g;
  if p_kind = 'draw' then insert into public.game_secrets (game_id, key, value) values (g.id, 'word', word); end if;
  -- mazzo: quali domande/parole sono già uscite (il telefono sceglie fra le altre; `reset` ricomincia dal mazzo pieno)
  if p_kind = 'quiz' or (p_kind = 'draw' and jsonb_typeof(p_params->'wordId') = 'number') then
    reset := coalesce((p_params->>'reset')::boolean, false);
    insert into public.game_decks (couple_id, kind, used)
    values (cid, p_kind, case when p_kind = 'quiz' then array(select (v)::int from jsonb_array_elements_text(qids) v) else array[(p_params->>'wordId')::int] end)
    on conflict (couple_id, kind) do update set used = case
      when reset then excluded.used
      else array(select distinct u from unnest(public.game_decks.used || excluded.used) u order by u) end;
  end if;
  return jsonb_build_object('ok', true, 'game', public._game_json(g));
end $$;

create or replace function public.game_move(p_game uuid, p_move jsonb, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; other uuid; g public.games; r jsonb; dup public.game_moves; nw public.games; seq int; pay jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_game is null or p_move is null or jsonb_typeof(p_move) <> 'object' or p_client_key is null or char_length(p_client_key) not between 8 and 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  select * into dup from public.game_moves where user_id = uid and client_key = p_client_key;
  if found then
    select * into g from public.games where id = dup.game_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(g));
  end if;
  select * into g from public.games where id = p_game and couple_id = cid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_game'); end if;
  if other is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;
  if (select count(*) from public.game_moves where user_id = uid and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  r := public._game_apply(g, uid, other, p_move);
  if (r->>'ok')::boolean is not true then return r; end if;
  update public.games set data = r->'data', turn = nullif(r->>'turn', '')::uuid, status = r->>'status', result = r->'result',
    rev = rev + 1, updated_at = now(), finished_at = case when r->>'status' = 'done' then now() else null end
  where id = g.id returning * into nw;
  seq := coalesce((select max(m.seq) from public.game_moves m where m.game_id = g.id), 0) + 1;
  pay := case when p_move->>'type' = 'answer' then jsonb_build_object('type', 'answer', 'q', p_move->'q') else p_move end;
  insert into public.game_moves (game_id, couple_id, user_id, seq, kind, payload, client_key) values (g.id, cid, uid, seq, p_move->>'type', pay, p_client_key);
  if nw.status = 'done' then perform public._game_score(nw, uid, other); end if;
  return jsonb_build_object('ok', true, 'game', public._game_json(nw), 'finished', nw.status = 'done');
end $$;

create or replace function public.abandon_game(p_game uuid, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; g public.games; seq int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into g from public.games where id = p_game and couple_id = cid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_game'); end if;
  if g.status <> 'open' then return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(g)); end if;
  update public.games set status = 'abandoned', turn = null, rev = rev + 1, updated_at = now(), finished_at = now(),
    result = jsonb_build_object('by', uid) where id = g.id returning * into g;
  seq := coalesce((select max(m.seq) from public.game_moves m where m.game_id = g.id), 0) + 1;
  insert into public.game_moves (game_id, couple_id, user_id, seq, kind, payload, client_key)
  values (g.id, cid, uid, seq, 'abandon', '{}'::jsonb, 'abandon-' || g.id::text)
  on conflict (user_id, client_key) do nothing;
  return jsonb_build_object('ok', true, 'game', public._game_json(g));
end $$;

-- Tutto per l'app in una chiamata: partite (aperte + l'ultima chiusa di ogni gioco + gli ultimi 12 disegni = l'album), punteggi, mazzi, i MIEI segreti.
create or replace function public.get_games() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; games jsonb := '[]'::jsonb; scores jsonb := '{}'::jsonb; decks jsonb := '{}'::jsonb; mine jsonb := '{}'::jsonb;
  r public.games; s record; sec jsonb; role text; k text; qs jsonb; qk jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  for r in
    select g.* from public.games g where g.couple_id = cid and (g.status = 'open' or g.id in (
      select distinct on (kind) id from public.games where couple_id = cid and status <> 'open' order by kind, created_at desc)
      or g.id in (select id from public.games where couple_id = cid and kind = 'draw' and status = 'done' order by created_at desc limit 12))
    order by g.created_at desc
  loop
    games := games || jsonb_build_array(public._game_json(r));
    sec := '{}'::jsonb;
    if r.kind = 'quiz' then
      for s in select key, value from public.game_secrets where game_id = r.id and key ~ '^q[0-4][sg]$' loop
        k := substr(s.key, 2, 1); role := substr(s.key, 3, 1);
        if (r.data->'subjects'->>(k::int))::uuid = uid and role = 's' or (r.data->'subjects'->>(k::int))::uuid <> uid and role = 'g' then
          qs := coalesce(sec->'qs', '{}'::jsonb);
          qk := coalesce(qs->k, '{}'::jsonb) || jsonb_build_object(role, s.value::int);
          sec := jsonb_build_object('qs', qs || jsonb_build_object(k, qk));
        end if;
      end loop;
    elsif r.kind = 'draw' and (r.data->>'drawer')::uuid = uid then
      sec := jsonb_build_object('word', (select value from public.game_secrets where game_id = r.id and key = 'word'));
    end if;
    if sec <> '{}'::jsonb then mine := jsonb_set(mine, array[r.id::text], sec, true); end if;
  end loop;
  scores := coalesce((select jsonb_object_agg(x.kind, x.m) from (
    select kind, jsonb_object_agg(user_id::text, jsonb_build_object('wins', wins, 'draws', draws, 'played', played)) as m
    from public.game_scores where couple_id = cid group by kind) x), '{}'::jsonb);
  for s in select kind, used from public.game_decks where couple_id = cid loop
    decks := jsonb_set(decks, array[s.kind], to_jsonb(s.used), true);
  end loop;
  return jsonb_build_object('ok', true, 'games', games, 'scores', scores, 'decks', decks, 'mine', mine);
end $$;

-- ---------- Privilegi e RLS ----------
revoke all on public.games, public.game_moves, public.game_secrets, public.game_scores, public.game_decks from anon, authenticated;
grant select on public.games, public.game_moves, public.game_scores to authenticated;
alter table public.games enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_decks enable row level security;

drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists game_moves_select on public.game_moves;
create policy game_moves_select on public.game_moves for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists game_scores_select on public.game_scores;
create policy game_scores_select on public.game_scores for select to authenticated using (couple_id = public.my_couple_id());
-- game_secrets e game_decks: nessuna policy e nessun privilegio (solo le funzioni security definer le toccano).

revoke all on function public._norm_word(text) from public, anon, authenticated;
revoke all on function public._same_word(text, text) from public, anon, authenticated;
revoke all on function public._tris_line(text) from public, anon, authenticated;
revoke all on function public._game_json(public.games) from public, anon, authenticated;
revoke all on function public._game_apply(public.games, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._game_score(public.games, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_game(uuid, text, jsonb) from public, anon;
revoke all on function public.game_move(uuid, jsonb, text) from public, anon;
revoke all on function public.abandon_game(uuid, text) from public, anon;
revoke all on function public.get_games() from public, anon;
grant execute on function public.start_game(uuid, text, jsonb) to authenticated;
grant execute on function public.game_move(uuid, jsonb, text) to authenticated;
grant execute on function public.abandon_game(uuid, text) to authenticated;
grant execute on function public.get_games() to authenticated;

-- ---------- Tempo reale (solo `games`: lo stato pubblico; i segreti non ci passano mai) ----------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;


-- ===== 20261119000001_extra7.sql =====
-- Fragolina · migrazione 8 · sessione 7: conto alla rovescia, domanda del giorno vera, ricordi (foto), "Il nostro mese".
-- Idempotente: si può rieseguire senza danni. NON tocca nulla delle migrazioni 1-7 (tranne `widget_feed`, che viene
-- ridefinita con in più la lista degli eventi: stessa porta, stesse regole di sicurezza).
--
--  • countdown_events   gli eventi di "Manca poco" (titolo, data, ora facoltativa, simbolo, uno solo "in evidenza").
--                       Last-write-wins per `at` (orario logico deciso dal telefono). Cancellazione = riga marcata.
--  • qa_days            la domanda di ogni giorno (giorno = Europe/Rome per entrambi): `ref` è un id del mazzo del
--                       telefono (q001…), "custom" = scritta da uno dei due, "l-…" = domanda della versione base.
--                       La prima persona che apre il giorno la fissa: l'altra vede la stessa anche se il mazzo cambia.
--  • qa_answers         "ha risposto" (PUBBLICO nella coppia, nel tempo reale): chi e quando, mai il testo.
--  • qa_texts           il TESTO della risposta. SEGRETO: l'altra persona lo vede solo dopo aver risposto lei allo
--                       stesso giorno (RLS + funzioni). Non è nel tempo reale.
--  • memories           foto (file nello Storage, bucket privato `memories`) e biglietti/disegni "tenuti".
-- Si scrive SOLO con le funzioni (upsert_event, answer_qa, add_memory…): nessuna scrittura diretta dai telefoni.

-- Giorno "della coppia": Europe/Rome per entrambi (le due persone possono essere in fusi diversi).
create or replace function public._rome_day() returns date
language sql stable as $$ select (now() at time zone 'Europe/Rome')::date $$;

-- ---------- Tabelle ----------
create table if not exists public.countdown_events (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 28),
  day date not null check (day between date '2000-01-01' and date '2100-12-31'),
  at_time text check (at_time is null or at_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  icon text not null check (icon in ('heart','plane','ticket','cake','gift','sun','star','house','train','balloon')),
  featured boolean not null default false,
  at bigint not null default 0,
  created_by uuid not null,
  updated_by uuid not null,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists countdown_events_couple_idx on public.countdown_events (couple_id, deleted, day);

create table if not exists public.qa_days (
  couple_id uuid not null references public.couples(id) on delete cascade,
  day date not null,
  ref text not null check (ref ~ '^(q[0-9]{3,5}|custom|l-[a-z0-9-]{1,40})$'),
  custom_text text check (custom_text is null or char_length(btrim(custom_text)) between 3 and 140),
  set_by uuid,
  created_at timestamptz not null default now(),
  primary key (couple_id, day),
  check ((ref = 'custom') = (custom_text is not null))
);

create table if not exists public.qa_answers (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  answered_at timestamptz not null default now(),
  primary key (couple_id, user_id, day)
);

create table if not exists public.qa_texts (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  text text not null default '',
  -- risposte della versione base (a/b): il testo sta nell'app, qui resta la scelta
  choice text check (choice is null or choice in ('a', 'b')),
  primary key (couple_id, user_id, day),
  check (choice is not null or char_length(btrim(text)) between 1 and 280)
);

create table if not exists public.memories (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('photo', 'draw', 'text')),
  source text not null check (source in ('photo', 'note', 'game')),
  caption text not null default '' check (char_length(caption) <= 120),
  day date not null check (day between date '2000-01-01' and date '2100-12-31'),
  path text,
  w int check (w is null or w between 1 and 8000),
  h int check (h is null or h between 1 and 8000),
  bytes int check (bytes is null or bytes between 1 and 1048576),
  content jsonb,
  by_user uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((kind = 'photo') = (path is not null)),
  check ((kind = 'photo') = (source = 'photo'))
);
create index if not exists memories_couple_idx on public.memories (couple_id, deleted_at, day desc);

-- ---------- Migrazione delle risposte della versione base (daily_answers → qa_*) ----------
-- Nessuna risposta già data va persa: ogni riga diventa una riga qa_answers + qa_texts (con `choice`), e il giorno
-- ricorda la domanda originale (ref "l-<id vecchio>"). Il segreto resta com'era: la scelta dell'altra persona si vede
-- solo se hai risposto tu allo stesso giorno. Rieseguibile: on conflict do nothing.
insert into public.qa_days (couple_id, day, ref)
select distinct on (a.couple_id, a.day) a.couple_id, a.day,
       'l-' || left(regexp_replace(lower(regexp_replace(a.question_id, '^q-', '')), '[^a-z0-9]+', '-', 'g'), 38)
  from public.daily_answers a
 order by a.couple_id, a.day, a.answered_at
on conflict (couple_id, day) do nothing;

insert into public.qa_answers (couple_id, user_id, day, answered_at)
select a.couple_id, a.user_id, a.day, a.answered_at from public.daily_answers a
on conflict (couple_id, user_id, day) do nothing;

insert into public.qa_texts (couple_id, user_id, day, text, choice)
select a.couple_id, a.user_id, a.day, '', a.answer from public.daily_answers a
on conflict (couple_id, user_id, day) do nothing;

-- ---------- Conto alla rovescia ----------
create or replace function public._event_json(e public.countdown_events) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', e.id, 'title', e.title, 'date', to_char(e.day, 'YYYY-MM-DD'), 'time', e.at_time,
    'icon', e.icon, 'featured', e.featured, 'at', e.at, 'by', e.updated_by)
$$;

create or replace function public._events_list(cid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._event_json(e) order by e.day, e.at_time nulls first, e.created_at), '[]'::jsonb)
    from public.countdown_events e where e.couple_id = cid and not e.deleted
$$;

create or replace function public.get_events() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  return jsonb_build_object('ok', true, 'events', public._events_list(cid));
end $$;

-- Crea o modifica un evento. Last-write-wins: vince `p_at` più grande (a parità vince l'ultimo arrivato).
-- Un solo evento "in evidenza" per coppia: se questo lo è, toglie l'evidenza agli altri.
create or replace function public.upsert_event(p_id uuid, p_title text, p_date date, p_time text, p_icon text,
  p_featured boolean, p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; cur public.countdown_events; t text := btrim(coalesce(p_title, ''));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_id is null or char_length(t) not between 1 and 28 or p_date is null or p_date not between date '2000-01-01' and date '2100-12-31'
     or p_icon is null or p_icon not in ('heart','plane','ticket','cake','gift','sun','star','house','train','balloon')
     or (p_time is not null and p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') or p_at is null or p_at < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  if (select count(*) from public.rate_events where kind = 'event_write' and user_id = uid and at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.rate_events (kind, user_id) values ('event_write', uid);
  select * into cur from public.countdown_events where id = p_id for update;
  if found and cur.couple_id <> cid then return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  if found then
    if cur.at <= p_at then
      update public.countdown_events set title = t, day = p_date, at_time = p_time, icon = p_icon, featured = coalesce(p_featured, false),
        at = p_at, updated_by = uid, deleted = false, updated_at = now() where id = p_id;
    end if;
  else
    if (select count(*) from public.countdown_events where couple_id = cid and not deleted) >= 60 then
      return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
    insert into public.countdown_events (id, couple_id, title, day, at_time, icon, featured, at, created_by, updated_by)
    values (p_id, cid, t, p_date, p_time, p_icon, coalesce(p_featured, false), p_at, uid, uid);
  end if;
  if coalesce(p_featured, false) and (select featured and not deleted from public.countdown_events where id = p_id) then
    update public.countdown_events set featured = false, updated_at = now() where couple_id = cid and id <> p_id and featured;
  end if;
  return jsonb_build_object('ok', true, 'events', public._events_list(cid));
end $$;

create or replace function public.delete_event(p_id uuid, p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; cur public.countdown_events;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into cur from public.countdown_events where id = p_id and couple_id = cid for update;
  if found and cur.at <= coalesce(p_at, 0) then
    update public.countdown_events set deleted = true, featured = false, at = coalesce(p_at, 0), updated_by = uid, updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('ok', true, 'events', public._events_list(cid));
end $$;

-- ---------- Domanda del giorno vera ----------
create or replace function public._i_answered_qa(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.qa_answers a where a.user_id = auth.uid() and a.day = p_day)
$$;

-- Un giorno: la domanda, la MIA risposta, se l'altra ha risposto e (solo se ho risposto io) la sua.
create or replace function public._qa_day_json(cid uuid, uid uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d public.qa_days; mine public.qa_texts; theirs public.qa_texts; mine_at timestamptz; theirs_at timestamptz; other uuid; out jsonb;
begin
  select * into d from public.qa_days where couple_id = cid and day = p_day;
  if not found then return null; end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  select * into mine from public.qa_texts where couple_id = cid and user_id = uid and day = p_day;
  select answered_at into mine_at from public.qa_answers where couple_id = cid and user_id = uid and day = p_day;
  select answered_at into theirs_at from public.qa_answers where couple_id = cid and user_id = other and day = p_day;
  out := jsonb_build_object('day', to_char(p_day, 'YYYY-MM-DD'), 'ref', d.ref, 'custom', d.custom_text, 'setBy', d.set_by,
    'mine', case when mine_at is null then null else jsonb_build_object('text', coalesce(mine.text, ''), 'choice', mine.choice, 'at', public._ms(mine_at)) end,
    'theirsAnswered', theirs_at is not null, 'theirs', null);
  if mine_at is not null and theirs_at is not null then
    select * into theirs from public.qa_texts where couple_id = cid and user_id = other and day = p_day;
    out := jsonb_set(out, '{theirs}', jsonb_build_object('text', coalesce(theirs.text, ''), 'choice', theirs.choice, 'at', public._ms(theirs_at)));
  end if;
  return out;
end $$;

-- Tutto per la scheda domanda in una chiamata. `p_today_ref` = la domanda che il telefono ha scelto per oggi: vale
-- SOLO se nessuno ha ancora aperto il giorno (la prima persona fissa la domanda per tutti e due).
create or replace function public.get_qa(p_today_ref text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; today date := public._rome_day(); tomorrow date := public._rome_day() + 1;
  days jsonb := '[]'::jsonb; r record; j jsonb; role text; tomorrow_role text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id, cm.role into cid, role from public.couple_members cm where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_today_ref is not null and p_today_ref ~ '^(q[0-9]{3,5}|l-[a-z0-9-]{1,40})$' then
    insert into public.qa_days (couple_id, day, ref) values (cid, today, p_today_ref) on conflict (couple_id, day) do nothing;
  end if;
  for r in
    select d.day from public.qa_days d
     where d.couple_id = cid and d.day <= tomorrow
       and (d.day >= today or d.ref = 'custom'
            or exists (select 1 from public.qa_answers a where a.couple_id = cid and a.day = d.day))
     order by d.day desc limit 500
  loop
    j := public._qa_day_json(cid, uid, r.day);
    if j is not null then days := days || jsonb_build_array(j); end if;
  end loop;
  tomorrow_role := case when ((tomorrow - date '1970-01-01') % 2) = 0 then 'a' else 'b' end;
  return jsonb_build_object('ok', true, 'today', to_char(today, 'YYYY-MM-DD'), 'tomorrow', to_char(tomorrow, 'YYYY-MM-DD'),
    'tomorrowTurn', tomorrow_role = role, 'days', days);
end $$;

create or replace function public.answer_qa(p_day date, p_ref text, p_text text, p_client_key text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; today date := public._rome_day(); t text := btrim(coalesce(p_text, ''));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_day is null or p_day not between today - 1 and today or char_length(t) not between 1 and 280
     or p_client_key is null or char_length(p_client_key) not between 8 and 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  if exists (select 1 from public.qa_answers where couple_id = cid and user_id = uid and day = p_day) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'day', public._qa_day_json(cid, uid, p_day)); -- una risposta al giorno, non si cambia
  end if;
  if (select count(*) from public.rate_events where kind = 'qa_answer' and user_id = uid and at > now() - interval '1 minute') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.rate_events (kind, user_id) values ('qa_answer', uid);
  if p_ref is not null and p_ref ~ '^(q[0-9]{3,5}|l-[a-z0-9-]{1,40})$' then
    insert into public.qa_days (couple_id, day, ref) values (cid, p_day, p_ref) on conflict (couple_id, day) do nothing;
  end if;
  if not exists (select 1 from public.qa_days where couple_id = cid and day = p_day) then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  insert into public.qa_texts (couple_id, user_id, day, text) values (cid, uid, p_day, t);
  insert into public.qa_answers (couple_id, user_id, day) values (cid, uid, p_day);
  return jsonb_build_object('ok', true, 'day', public._qa_day_json(cid, uid, p_day));
end $$;

-- "Scrivi tu la domanda di domani": a turni. Domani la scrive il ruolo `a` se il numero del giorno è pari, `b` se dispari
-- (quindi ognuno ogni due giorni, senza stato da tenere). Si può riscrivere finché domani non comincia.
create or replace function public.set_tomorrow_question(p_text text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; role text; tomorrow date := public._rome_day() + 1; t text := btrim(coalesce(p_text, ''));
  want text := case when ((public._rome_day() + 1 - date '1970-01-01') % 2) = 0 then 'a' else 'b' end;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id, cm.role into cid, role from public.couple_members cm where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if role <> want then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
  if char_length(t) not between 3 and 140 then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  if (select count(*) from public.rate_events where kind = 'qa_custom' and user_id = uid and at > now() - interval '1 minute') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.rate_events (kind, user_id) values ('qa_custom', uid);
  insert into public.qa_days (couple_id, day, ref, custom_text, set_by) values (cid, tomorrow, 'custom', t, uid)
  on conflict (couple_id, day) do update set ref = 'custom', custom_text = excluded.custom_text, set_by = uid
   where not exists (select 1 from public.qa_answers a where a.couple_id = excluded.couple_id and a.day = excluded.day);
  return jsonb_build_object('ok', true, 'day', public._qa_day_json(cid, uid, tomorrow));
end $$;

-- ---------- Ricordi ----------
create or replace function public._memory_json(m public.memories) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', m.id, 'kind', m.kind, 'source', m.source, 'caption', m.caption, 'day', to_char(m.day, 'YYYY-MM-DD'),
    'path', m.path, 'w', m.w, 'h', m.h, 'bytes', m.bytes, 'content', m.content, 'by', m.by_user, 'createdAt', public._ms(m.created_at))
$$;

create or replace function public.get_memories() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  return jsonb_build_object('ok', true, 'memories', coalesce((
    select jsonb_agg(public._memory_json(m) order by m.day desc, m.created_at desc)
      from (select * from public.memories where couple_id = cid and deleted_at is null order by day desc, created_at desc limit 1500) m), '[]'::jsonb));
end $$;

-- Aggiunge un ricordo. Idempotente per `p_id` (per i biglietti e i giochi è l'id del biglietto/della partita: tenerlo due
-- volte non lo duplica). La foto prima va nello Storage (cartella della coppia), poi si registra qui.
create or replace function public.add_memory(p_id uuid, p_kind text, p_source text, p_caption text, p_day date, p_path text,
  p_w int, p_h int, p_bytes int, p_content jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; cur public.memories; cap text := coalesce(btrim(p_caption), ''); m public.memories; exists_obj boolean := true;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into cur from public.memories where id = p_id;
  if found then
    if cur.couple_id <> cid then return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'memory', public._memory_json(cur));
  end if;
  if p_id is null or p_kind not in ('photo', 'draw', 'text') or p_source not in ('photo', 'note', 'game')
     or char_length(cap) > 120 or p_day is null or p_day not between date '2000-01-01' and public._rome_day() + 1
     or (p_kind = 'photo') <> (p_source = 'photo') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  if p_kind = 'photo' then
    if p_path is null or p_path !~ ('^' || cid::text || '/[0-9a-f-]{36}\.jpg$') or p_w is null or p_h is null or p_bytes is null
       or p_bytes not between 1 and 1048576 or p_w not between 1 and 8000 or p_h not between 1 and 8000 then
      return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
    if to_regclass('storage.objects') is not null then
      execute 'select exists (select 1 from storage.objects where bucket_id = ''memories'' and name = $1)' into exists_obj using p_path;
      if not exists_obj then return jsonb_build_object('ok', false, 'error', 'no_file'); end if;
    end if;
  else
    if p_path is not null or not public._note_valid(p_kind, p_content) then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  end if;
  if (select count(*) from public.rate_events where kind = 'memory_add' and user_id = uid and at > now() - interval '1 minute') >= 30 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if (select count(*) from public.memories where couple_id = cid and deleted_at is null) >= 3000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  insert into public.rate_events (kind, user_id) values ('memory_add', uid);
  insert into public.memories (id, couple_id, kind, source, caption, day, path, w, h, bytes, content, by_user)
  values (p_id, cid, p_kind, p_source, cap, p_day, p_path, p_w, p_h, p_bytes, case when p_kind = 'photo' then null else p_content end, uid)
  returning * into m;
  return jsonb_build_object('ok', true, 'memory', public._memory_json(m));
end $$;

-- Solo chi l'ha aggiunto la toglie. Restituisce il percorso del file (il telefono lo cancella anche dallo Storage).
create or replace function public.delete_memory(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; cur public.memories;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into cur from public.memories where id = p_id and couple_id = cid for update;
  if not found then return jsonb_build_object('ok', true, 'duplicate', true, 'path', null); end if;
  if cur.by_user <> uid then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;
  if cur.deleted_at is null then update public.memories set deleted_at = now() where id = p_id; end if;
  return jsonb_build_object('ok', true, 'path', cur.path);
end $$;

-- ---------- "Il nostro mese" ----------
create or replace function public.get_month(p_year int, p_month int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; first_day date; next_day date; moods jsonb; pings jsonb; games jsonb; qa int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_year is null or p_month is null or p_year not between 2000 and 2100 or p_month not between 1 and 12 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  first_day := make_date(p_year, p_month, 1);
  next_day := (first_day + interval '1 month')::date;
  moods := coalesce((select jsonb_agg(jsonb_build_object('u', x.user_id, 'd', to_char(x.d, 'YYYY-MM-DD'), 'm', x.mood_id) order by x.d, x.user_id) from (
    select distinct on (m.user_id, d) m.user_id, (coalesce(m.client_at, m.created_at) at time zone 'Europe/Rome')::date as d, m.mood_id
      from public.mood_events m
     where m.couple_id = cid
       and (coalesce(m.client_at, m.created_at) at time zone 'Europe/Rome')::date >= first_day
       and (coalesce(m.client_at, m.created_at) at time zone 'Europe/Rome')::date < next_day
     order by m.user_id, d, coalesce(m.client_at, m.created_at) desc) x), '[]'::jsonb);
  pings := coalesce((select jsonb_object_agg(x.from_user::text, x.n) from (
    select from_user, count(*)::int as n from public.pings
     where couple_id = cid and (created_at at time zone 'Europe/Rome')::date >= first_day and (created_at at time zone 'Europe/Rome')::date < next_day
     group by from_user) x), '{}'::jsonb);
  games := coalesce((select jsonb_object_agg(x.kind, x.n) from (
    select kind, count(*)::int as n from public.games
     where couple_id = cid and status = 'done' and (finished_at at time zone 'Europe/Rome')::date >= first_day and (finished_at at time zone 'Europe/Rome')::date < next_day
     group by kind) x), '{}'::jsonb);
  select count(*)::int into qa from (
    select a.day from public.qa_answers a where a.couple_id = cid and a.day >= first_day and a.day < next_day
     group by a.day having count(*) = 2) z;
  return jsonb_build_object('ok', true, 'year', p_year, 'month', p_month, 'moods', moods, 'pings', pings, 'games', games, 'qaBoth', qa);
end $$;

-- ---------- Feed del widget (Percorso B): in più gli eventi del conto alla rovescia ----------
-- Stessa porta di prima (chiave pubblica + token): restituisce ancora SOLO biglietto e posizione dell'altra persona; in più
-- i prossimi eventi (non ancora passati, l'in-evidenza per primo). Nessun altro dato esce.
create or replace function public.widget_feed(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare uid uuid; cid uuid; nowms bigint := public._now_ms(); loc jsonb; evs jsonb;
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
  evs := coalesce((select jsonb_agg(public._event_json(x)) from (
    select * from public.countdown_events e
     where e.couple_id = cid and not e.deleted and e.day >= public._rome_day() - 1
     order by e.featured desc, e.day, e.at_time nulls first limit 5) x), '[]'::jsonb);
  return jsonb_build_object('ok', true, 'now', nowms,
    'note', public._note_latest(cid, uid, true),
    'partner', loc->'partner',
    'events', evs);
end $$;

-- ---------- Storage: bucket privato `memories`, una cartella per coppia ----------
-- Solo i due membri leggono e scrivono la cartella della loro coppia (`<id coppia>/<id foto>.jpg`); cancella solo chi
-- ha caricato il file. Foto solo JPEG, al massimo 1 MB. Il bucket non è pubblico: si vede solo con URL firmati a scadenza breve.
-- (Dove non c'è lo schema `storage`, ad esempio nel Postgres di prova, questo blocco non fa nulla.)
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('memories', 'memories', false, 1048576, array['image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
  end if;
  if to_regclass('storage.objects') is not null then
    drop policy if exists memories_read on storage.objects;
    execute $p$create policy memories_read on storage.objects for select to authenticated
      using (bucket_id = 'memories' and (storage.foldername(name))[1] = public.my_couple_id()::text)$p$;
    drop policy if exists memories_write on storage.objects;
    execute $p$create policy memories_write on storage.objects for insert to authenticated
      with check (bucket_id = 'memories' and (storage.foldername(name))[1] = public.my_couple_id()::text)$p$;
    drop policy if exists memories_remove on storage.objects;
    execute $p$create policy memories_remove on storage.objects for delete to authenticated
      using (bucket_id = 'memories' and (storage.foldername(name))[1] = public.my_couple_id()::text
             and coalesce(owner_id, owner::text) = auth.uid()::text)$p$;
  end if;
end $$;

-- ---------- Privilegi e RLS ----------
revoke all on public.countdown_events, public.qa_days, public.qa_answers, public.qa_texts, public.memories from anon, authenticated;
grant select on public.countdown_events, public.qa_days, public.qa_answers, public.qa_texts, public.memories to authenticated;
alter table public.countdown_events enable row level security;
alter table public.qa_days enable row level security;
alter table public.qa_answers enable row level security;
alter table public.qa_texts enable row level security;
alter table public.memories enable row level security;

drop policy if exists events_select on public.countdown_events;
create policy events_select on public.countdown_events for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists qa_days_select on public.qa_days;
create policy qa_days_select on public.qa_days for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists qa_answers_select on public.qa_answers;
create policy qa_answers_select on public.qa_answers for select to authenticated using (couple_id = public.my_couple_id());
-- Il testo dell'altra persona si vede SOLO dopo aver risposto tu allo stesso giorno.
drop policy if exists qa_texts_select on public.qa_texts;
create policy qa_texts_select on public.qa_texts for select to authenticated
  using (couple_id = public.my_couple_id() and (user_id = auth.uid() or public._i_answered_qa(day)));
drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories for select to authenticated
  using (couple_id = public.my_couple_id() and deleted_at is null);

revoke all on function public._rome_day() from public, anon, authenticated;
revoke all on function public._event_json(public.countdown_events) from public, anon, authenticated;
revoke all on function public._events_list(uuid) from public, anon, authenticated;
revoke all on function public._qa_day_json(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public._memory_json(public.memories) from public, anon, authenticated;
revoke all on function public._i_answered_qa(date) from public, anon;
grant execute on function public._i_answered_qa(date) to authenticated;
revoke all on function public.get_events() from public, anon;
revoke all on function public.upsert_event(uuid, text, date, text, text, boolean, bigint) from public, anon;
revoke all on function public.delete_event(uuid, bigint) from public, anon;
revoke all on function public.get_qa(text) from public, anon;
revoke all on function public.answer_qa(date, text, text, text) from public, anon;
revoke all on function public.set_tomorrow_question(text) from public, anon;
revoke all on function public.get_memories() from public, anon;
revoke all on function public.add_memory(uuid, text, text, text, date, text, int, int, int, jsonb) from public, anon;
revoke all on function public.delete_memory(uuid) from public, anon;
revoke all on function public.get_month(int, int) from public, anon;
revoke all on function public.widget_feed(text) from public;
grant execute on function public.get_events() to authenticated;
grant execute on function public.upsert_event(uuid, text, date, text, text, boolean, bigint) to authenticated;
grant execute on function public.delete_event(uuid, bigint) to authenticated;
grant execute on function public.get_qa(text) to authenticated;
grant execute on function public.answer_qa(date, text, text, text) to authenticated;
grant execute on function public.set_tomorrow_question(text) to authenticated;
grant execute on function public.get_memories() to authenticated;
grant execute on function public.add_memory(uuid, text, text, text, date, text, int, int, int, jsonb) to authenticated;
grant execute on function public.delete_memory(uuid) to authenticated;
grant execute on function public.get_month(int, int) to authenticated;
grant execute on function public.widget_feed(text) to anon, authenticated;

-- ---------- Tempo reale ----------
-- `qa_answers` dice solo "ha risposto" (mai il testo, che non è nel tempo reale). `qa_texts` NON ci sta.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['countdown_events', 'qa_days', 'qa_answers', 'memories'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
