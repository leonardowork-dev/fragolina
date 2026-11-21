-- Sessione 11: il pet mangia a 3 pezzi, guadagna esperienza e livelli, si veste (guardaroba sincronizzato).
-- Rieseguibile. Specchio di src/lib/pet/rules.ts (costanti FOOD_PIECE, FULL_AT, DECAY_PER_HOUR.food, XP_*, LEVEL_AT, OUTFIT_ITEMS).

alter table public.pets add column if not exists xp int not null default 0 check (xp >= 0);
alter table public.pets add column if not exists outfit jsonb not null default '{}'::jsonb;
alter table public.pets add column if not exists outfit_at bigint not null default 0;

-- Livello (1-10) dai punti esperienza.
create or replace function public._pet_level(p_xp int) returns int
language sql immutable as $$
  select count(*)::int from unnest(array[0, 40, 100, 180, 280, 400, 550, 730, 940, 1180]) t where p_xp >= t
$$;

-- Livello da cui si sblocca un indumento (null = non esiste per quel posto).
create or replace function public._pet_item_level(p_slot text, p_item text) returns int
language sql immutable as $$
  select case p_slot || ':' || p_item
    when 'head:cap' then 2 when 'head:bow' then 3 when 'head:phones' then 4 when 'head:flowers' then 5
    when 'head:chef' then 6 when 'head:halo' then 8
    when 'eyes:shades' then 3 when 'eyes:round' then 5
    when 'neck:scarf' then 2 when 'neck:bowtie' then 4 when 'neck:pearls' then 7
    when 'body:sweater' then 3 when 'body:cape' then 6 when 'body:tutu' then 9
    else null end
$$;

-- Un passo: come prima, più: frutto = 1/3 di pancia (il quarto si rifiuta: azione ignorata), calo della pancia 100/h,
-- punti esperienza (cure +8/+10, bonus +5 quando curate entrambi lo stesso giorno).
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
  both_before int;
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

  f := public._pet_decay(p.food, 100, t - p.at);
  l := public._pet_decay(p.love, 30, t - p.at);
  e := public._pet_decay(p.energy, 20, t - p.at);
  -- pieno: tre pezzi sono già nella pancia (la pancia è "a pezzi" da 334)
  if p_kind = 'feed' and f >= 669 then return r; end if;
  both_before := r.both_days;
  r.sleep_until := 0;
  if p_kind = 'feed' then
    f := f + 334;
    if p_item = 'lampone' then l := l + 50; end if;
    if p_item = 'mirtillo' then e := e + 100; end if;
    r.xp := r.xp + 10;
  elsif p_kind = 'cuddle' then
    l := l + 250; r.xp := r.xp + 8;
  elsif p_kind = 'play' then
    l := l + 150; e := e - 100; r.xp := r.xp + 8;
  elsif p_kind = 'sleep' then
    e := e + 500; r.xp := r.xp + 10;
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
  if r.both_days > both_before then r.xp := r.xp + 5; end if;
  return r;
end $$;

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
    'last_by', p.last_by, 'last_kind', p.last_kind, 'last_item', p.last_item, 'last_key', p.last_key,
    'xp', p.xp, 'outfit', p.outfit, 'outfit_at', p.outfit_at)
$$;

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
    rev = nw.rev, xp = nw.xp, hatched_at = nw.hatched_at, hatched_by = nw.hatched_by,
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

-- Il guardaroba: {"head":"cap","eyes":null,"neck":"scarf","body":null}. Si può indossare solo ciò che il livello sblocca.
-- Vince l'ultima modifica (last-write-wins, `outfit_at`).
create or replace function public.set_pet_outfit(p_outfit jsonb, p_client_at bigint, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid(); cid uuid; pr public.pets; slot text; item text; lvl int; out jsonb := '{}'::jsonb;
  nowms bigint := public._now_ms(); t bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_outfit is null or jsonb_typeof(p_outfit) <> 'object' then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  select * into pr from public.pets where couple_id = cid for update;
  if not found or pr.hatched_at is null then return jsonb_build_object('ok', false, 'error', 'not_hatched'); end if;
  for slot in select jsonb_object_keys(p_outfit) loop
    if slot not in ('head', 'eyes', 'neck', 'body') then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
    if jsonb_typeof(p_outfit -> slot) = 'null' then continue; end if;
    if jsonb_typeof(p_outfit -> slot) <> 'string' then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
    item := p_outfit ->> slot;
    lvl := public._pet_item_level(slot, item);
    if lvl is null then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
    if lvl > public._pet_level(pr.xp) then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
    out := out || jsonb_build_object(slot, item);
  end loop;
  t := greatest(least(coalesce(p_client_at, nowms), nowms), nowms - 172800000);
  if t >= pr.outfit_at then
    update public.pets set outfit = out, outfit_at = t, rev = rev + 1, last_by = uid, last_kind = 'name',
           last_item = null, last_key = p_client_key, updated_at = now()
     where couple_id = cid returning * into pr;
  end if;
  return jsonb_build_object('ok', true, 'pet', public._pet_json(pr));
end $$;

revoke all on function public._pet_level(int) from public, anon, authenticated;
revoke all on function public._pet_item_level(text, text) from public, anon, authenticated;
revoke all on function public.set_pet_outfit(jsonb, bigint, text) from public, anon;
grant execute on function public.set_pet_outfit(jsonb, bigint, text) to authenticated;
revoke all on function public.pet_act(text, text, int, date, text, bigint) from public, anon;
grant execute on function public.pet_act(text, text, int, date, text, bigint) to authenticated;
