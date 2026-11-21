-- Sessione 10: la "zona" privata di coppia (calendario dei cuoricini, desideri a sorpresa, segnale, stasera, buoni).
-- PRIVACY: tutte le tabelle z_* hanno RLS attiva e NESSUNA policy e nessun privilegio per i client: si leggono e si scrivono
-- SOLO con le funzioni qui sotto (security definer, solo membri della coppia). Nel realtime passa SOLO z_pulse
-- (un contatore, nessun contenuto): il telefono, quando vede il contatore cambiare, rilegge con z_get.
-- widget_feed e get_state NON toccano queste tabelle.

create table if not exists public.z_entries (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  at bigint not null,
  place text check (place is null or place in ('letto','divano','doccia','auto','fuori','altro')),
  starter text check (starter is null or starter in ('a','b','both')),
  rating int check (rating is null or rating between 1 and 5),
  note text check (note is null or char_length(note) <= 140),
  deleted boolean not null default false,
  updated_at bigint not null
);
create index if not exists z_entries_couple_day on public.z_entries (couple_id, day);

create table if not exists public.z_ideas (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 3 and 80),
  level text not null check (level in ('dolce','piccante','audace'))
);

create table if not exists public.z_wishes (
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  idea_id text not null check (idea_id ~ '^(d[0-9]{3}|c-[0-9a-f-]{36})$'),
  primary key (user_id, idea_id)
);

create table if not exists public.z_tonight (
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  day date not null,
  answer text not null check (answer in ('yes','maybe','no')),
  primary key (user_id, day)
);

create table if not exists public.z_signals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  level int not null check (level between 1 and 3),
  at bigint not null,
  expires_at bigint not null
);

create table if not exists public.z_vouchers (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 40),
  expires date,
  redeemed_at bigint,
  deleted boolean not null default false,
  created_at bigint not null
);

-- Contatore per il tempo reale: nessun contenuto.
create table if not exists public.z_pulse (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  n bigint not null default 0,
  at bigint not null default 0
);

alter table public.z_entries enable row level security;
alter table public.z_ideas enable row level security;
alter table public.z_wishes enable row level security;
alter table public.z_tonight enable row level security;
alter table public.z_signals enable row level security;
alter table public.z_vouchers enable row level security;
alter table public.z_pulse enable row level security;
revoke all on public.z_entries, public.z_ideas, public.z_wishes, public.z_tonight, public.z_signals, public.z_vouchers, public.z_pulse from anon, authenticated;
drop policy if exists z_pulse_members on public.z_pulse;
create policy z_pulse_members on public.z_pulse for select to authenticated using (couple_id = public.my_couple_id());
grant select on public.z_pulse to authenticated;

create or replace function public._z_touch(cid uuid) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.z_pulse (couple_id, n, at) values (cid, 1, public._now_ms())
  on conflict (couple_id) do update set n = public.z_pulse.n + 1, at = excluded.at
$$;

create or replace function public._z_cid() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

-- Tutto quello che la zona mostra, per chi chiama. I desideri dell'altro NON escono mai: solo i match.
create or replace function public.z_get() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); cid uuid; other uuid; today date := public._rome_day(); nowms bigint := public._now_ms();
  mine text; theirs text; res text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  select answer into mine from public.z_tonight where user_id = uid and day = today;
  select answer into theirs from public.z_tonight where user_id = other and day = today;
  if mine is not null and theirs is not null then
    res := case when (mine = 'yes' and theirs in ('yes','maybe')) or (mine = 'maybe' and theirs = 'yes') then 'match' else 'nomatch' end;
  end if;
  return jsonb_build_object(
    'ok', true, 'now', nowms, 'today', today,
    'pulse', coalesce((select n from public.z_pulse where couple_id = cid), 0),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'day', e.day, 'at', e.at, 'place', e.place, 'starter', e.starter, 'rating', e.rating,
        'note', e.note, 'by', (select role from public.couple_members m where m.user_id = e.user_id), 'updatedAt', e.updated_at)
        order by e.day, e.at) from public.z_entries e where e.couple_id = cid and not e.deleted), '[]'::jsonb),
    'ideas', coalesce((select jsonb_agg(jsonb_build_object('id', 'c-' || i.id, 'text', i.text, 'level', i.level, 'mine', i.user_id = uid)
        order by i.id) from public.z_ideas i where i.couple_id = cid), '[]'::jsonb),
    'wishesMine', coalesce((select jsonb_agg(w.idea_id order by w.idea_id) from public.z_wishes w where w.user_id = uid), '[]'::jsonb),
    'matches', coalesce((select jsonb_agg(x.idea_id order by x.idea_id) from (
        select idea_id from public.z_wishes where couple_id = cid group by idea_id having count(distinct user_id) = 2) x), '[]'::jsonb),
    'tonight', jsonb_build_object('day', today, 'mine', mine, 'otherAnswered', theirs is not null, 'result', res),
    'signal', jsonb_build_object(
      'incoming', (select jsonb_build_object('level', s.level, 'at', s.at, 'expiresAt', s.expires_at)
                     from public.z_signals s where s.user_id = other and s.expires_at > nowms),
      'mine', (select jsonb_build_object('level', s.level, 'at', s.at, 'expiresAt', s.expires_at)
                     from public.z_signals s where s.user_id = uid and s.expires_at > nowms)),
    'vouchers', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'title', v.title, 'expires', v.expires, 'redeemedAt', v.redeemed_at, 'createdAt', v.created_at,
        'fromMe', v.from_user = uid) order by v.created_at) from public.z_vouchers v where v.couple_id = cid and not v.deleted), '[]'::jsonb)
  );
end $$;

create or replace function public.z_log(
  p_id uuid, p_day date, p_at bigint, p_place text, p_starter text, p_rating int, p_note text
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; nowms bigint := public._now_ms(); note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_id is null or p_day is null or p_day < public._rome_day() - 3650 or p_day > public._rome_day() + 1
     or p_place is not null and p_place not in ('letto','divano','doccia','auto','fuori','altro')
     or p_starter is not null and p_starter not in ('a','b','both')
     or p_rating is not null and p_rating not between 1 and 5
     or note is not null and char_length(note) > 140 then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if exists (select 1 from public.z_entries where id = p_id and couple_id <> cid) then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if (select count(*) from public.z_entries where couple_id = cid) >= 5000
     and not exists (select 1 from public.z_entries where id = p_id) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.z_entries (id, couple_id, user_id, day, at, place, starter, rating, note, deleted, updated_at)
  values (p_id, cid, uid, p_day, least(coalesce(p_at, nowms), nowms + 86400000), p_place, p_starter, p_rating, note, false, nowms)
  on conflict (id) do update set day = excluded.day, place = excluded.place, starter = excluded.starter,
    rating = excluded.rating, note = excluded.note, deleted = false, updated_at = excluded.updated_at;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_log_delete(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  update public.z_entries set deleted = true, note = null, updated_at = public._now_ms() where id = p_id and couple_id = cid;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_idea_add(p_id uuid, p_text text, p_level text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; t text := btrim(coalesce(p_text, ''));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_id is null or char_length(t) not between 3 and 80 or p_level not in ('dolce','piccante','audace') then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if exists (select 1 from public.z_ideas where id = p_id) then return jsonb_build_object('ok', true); end if;
  if (select count(*) from public.z_ideas where couple_id = cid) >= 100 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.z_ideas (id, couple_id, user_id, text, level) values (p_id, cid, uid, t, p_level);
  -- chi la scrive la vuole: conta come scelta sua
  insert into public.z_wishes (user_id, couple_id, idea_id) values (uid, cid, 'c-' || p_id::text) on conflict do nothing;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_idea_delete(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  delete from public.z_wishes where couple_id = cid and idea_id = 'c-' || p_id::text
     and exists (select 1 from public.z_ideas where id = p_id and user_id = uid);
  delete from public.z_ideas where id = p_id and user_id = uid;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

-- Scelgo (o tolgo) un desiderio. Il match si calcola solo in z_get e solo se l'hanno scelto entrambi.
create or replace function public.z_wish(p_idea text, p_on boolean) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_idea is null or p_idea !~ '^(d[0-9]{3}|c-[0-9a-f-]{36})$' then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  if p_idea like 'c-%' and not exists (select 1 from public.z_ideas where couple_id = cid and 'c-' || id::text = p_idea) then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if coalesce(p_on, false) then
    insert into public.z_wishes (user_id, couple_id, idea_id) values (uid, cid, p_idea) on conflict do nothing;
  else
    delete from public.z_wishes where user_id = uid and idea_id = p_idea;
  end if;
  -- il contatore cambia SOLO se può essere nato un match (così chi sceglie da solo non fa rumore)
  if exists (select 1 from public.z_wishes where couple_id = cid and idea_id = p_idea and user_id <> uid) then
    perform public._z_touch(cid);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_tonight(p_answer text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; today date := public._rome_day(); other uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_answer is null or p_answer not in ('yes','maybe','no') then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  -- a risposte date da entrambi non si cambia più (niente tentativi di indovinare)
  if exists (select 1 from public.z_tonight where user_id = other and day = today)
     and exists (select 1 from public.z_tonight where user_id = uid and day = today) then
    return jsonb_build_object('ok', false, 'error', 'already_answered');
  end if;
  insert into public.z_tonight (user_id, couple_id, day, answer) values (uid, cid, today, p_answer)
  on conflict (user_id, day) do update set answer = excluded.answer;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_signal(p_level int) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; nowms bigint := public._now_ms(); ttl bigint;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if p_level is null or p_level not between 1 and 3 then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
  ttl := case p_level when 1 then 6 * 3600000 when 2 then 4 * 3600000 else 3600000 end;
  insert into public.z_signals (user_id, couple_id, level, at, expires_at) values (uid, cid, p_level, nowms, nowms + ttl)
  on conflict (user_id) do update set level = excluded.level, at = excluded.at, expires_at = excluded.expires_at;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_signal_clear() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  delete from public.z_signals where user_id = uid;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_voucher_add(p_id uuid, p_title text, p_expires date) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; other uuid; t text := btrim(coalesce(p_title, ''));
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  if other is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;
  if p_id is null or char_length(t) not between 2 and 40 or (p_expires is not null and p_expires < public._rome_day() - 1) then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  if exists (select 1 from public.z_vouchers where id = p_id) then return jsonb_build_object('ok', true); end if;
  if (select count(*) from public.z_vouchers where couple_id = cid) >= 200 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.z_vouchers (id, couple_id, from_user, to_user, title, expires, created_at)
  values (p_id, cid, uid, other, t, p_expires, public._now_ms());
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_voucher_redeem(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); v public.z_vouchers;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v from public.z_vouchers where id = p_id and to_user = uid and not deleted;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v.redeemed_at is not null then return jsonb_build_object('ok', true); end if;
  if v.expires is not null and v.expires < public._rome_day() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  update public.z_vouchers set redeemed_at = public._now_ms() where id = p_id;
  perform public._z_touch(v.couple_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.z_voucher_delete(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  update public.z_vouchers set deleted = true where id = p_id and from_user = uid and couple_id = cid;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

-- "Cancella tutto": i dati della zona di tutti e due spariscono dal server.
create or replace function public.z_wipe() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  delete from public.z_entries where couple_id = cid;
  delete from public.z_wishes where couple_id = cid;
  delete from public.z_ideas where couple_id = cid;
  delete from public.z_tonight where couple_id = cid;
  delete from public.z_signals where couple_id = cid;
  delete from public.z_vouchers where couple_id = cid;
  perform public._z_touch(cid);
  return jsonb_build_object('ok', true);
end $$;

-- Chi lascia la coppia porta via le proprie scelte segrete.
create or replace function public.tg_z_member_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.z_wishes where user_id = old.user_id;
  delete from public.z_tonight where user_id = old.user_id;
  delete from public.z_signals where user_id = old.user_id;
  return old;
end $$;
drop trigger if exists couple_members_z_cleanup on public.couple_members;
create trigger couple_members_z_cleanup after delete on public.couple_members
  for each row execute function public.tg_z_member_cleanup();

revoke all on function public._z_touch(uuid) from public, anon, authenticated;
revoke all on function public._z_cid() from public, anon, authenticated;
revoke all on function public.tg_z_member_cleanup() from public, anon, authenticated;
revoke all on function public.z_get() from public, anon;
revoke all on function public.z_log(uuid, date, bigint, text, text, int, text) from public, anon;
revoke all on function public.z_log_delete(uuid) from public, anon;
revoke all on function public.z_idea_add(uuid, text, text) from public, anon;
revoke all on function public.z_idea_delete(uuid) from public, anon;
revoke all on function public.z_wish(text, boolean) from public, anon;
revoke all on function public.z_tonight(text) from public, anon;
revoke all on function public.z_signal(int) from public, anon;
revoke all on function public.z_signal_clear() from public, anon;
revoke all on function public.z_voucher_add(uuid, text, date) from public, anon;
revoke all on function public.z_voucher_redeem(uuid) from public, anon;
revoke all on function public.z_voucher_delete(uuid) from public, anon;
revoke all on function public.z_wipe() from public, anon;
grant execute on function public.z_get() to authenticated;
grant execute on function public.z_log(uuid, date, bigint, text, text, int, text) to authenticated;
grant execute on function public.z_log_delete(uuid) to authenticated;
grant execute on function public.z_idea_add(uuid, text, text) to authenticated;
grant execute on function public.z_idea_delete(uuid) to authenticated;
grant execute on function public.z_wish(text, boolean) to authenticated;
grant execute on function public.z_tonight(text) to authenticated;
grant execute on function public.z_signal(int) to authenticated;
grant execute on function public.z_signal_clear() to authenticated;
grant execute on function public.z_voucher_add(uuid, text, date) to authenticated;
grant execute on function public.z_voucher_redeem(uuid) to authenticated;
grant execute on function public.z_voucher_delete(uuid) to authenticated;
grant execute on function public.z_wipe() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'z_pulse') then
    alter publication supabase_realtime add table public.z_pulse;
  end if;
end $$;
