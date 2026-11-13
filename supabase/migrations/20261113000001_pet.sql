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
