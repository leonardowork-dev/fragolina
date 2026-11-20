-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 8 (rifinitura): pulizia dei "penso a te" più vecchi di 90 giorni, con archivio dei conteggi.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Non perde nulla di ciò che l'app mostra (totali e "Il nostro mese" contano anche l'archivio).
-- Rieseguibile quante volte vuoi. ATTENZIONE: ridefinisce get_state e get_month; se rilanci a mano un file più vecchio (sessione7), rilancia dopo anche questo.

-- Sessione 8 · Rifinitura: pulizia dei "penso a te" più vecchi di 90 giorni (per restare nel piano gratuito, 500 MB).
-- IDEMPOTENTE: si può rilanciare quante volte si vuole. Non perde nulla di ciò che l'app mostra:
--  * i pensieri vecchi vengono tolti da `pings` ma CONTATI in `ping_archive` (per coppia, persona e mese di Roma);
--  * `get_state` (totale ricevuti, ultimo pensiero) e `get_month` ("Il nostro mese") sommano tabella + archivio;
--  * la pulizia parte da sola, ogni tanto (circa 1 pensiero inviato su 50), e una volta subito, qui sotto.
-- La chiave di idempotenza dei pensieri (client_key) vale solo per i pensieri recenti: nessun telefono rimanda una
-- chiave di 90 giorni fa.

create table if not exists public.ping_archive (
  couple_id uuid not null references public.couples(id) on delete cascade,
  from_user uuid not null,
  month date not null,
  n int not null check (n >= 0),
  last_at timestamptz not null,
  primary key (couple_id, from_user, month)
);
alter table public.ping_archive enable row level security;
revoke all on public.ping_archive from public, anon, authenticated;
-- nessuna policy: lo leggono solo le funzioni (security definer)

create or replace function public._prune_pings() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  with moved as (
    delete from public.pings where created_at < now() - interval '90 days'
    returning couple_id, from_user, created_at)
  insert into public.ping_archive (couple_id, from_user, month, n, last_at)
  select couple_id, from_user, date_trunc('month', created_at at time zone 'Europe/Rome')::date, count(*)::int, max(created_at)
    from moved group by 1, 2, 3
  on conflict (couple_id, from_user, month) do update
    set n = public.ping_archive.n + excluded.n,
        last_at = greatest(public.ping_archive.last_at, excluded.last_at);
end $$;
revoke all on function public._prune_pings() from public, anon, authenticated;

create or replace function public.tg_pings_prune() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.02 then perform public._prune_pings(); end if;
  return new;
end $$;
drop trigger if exists pings_prune on public.pings;
create trigger pings_prune before insert on public.pings
  for each row execute function public.tg_pings_prune();

-- get_state: come prima, ma totale e ultimo pensiero contano anche l'archivio.
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
      where p.couple_id = cid and p.from_user <> uid)
      + coalesce((select sum(x.n) from public.ping_archive x where x.couple_id = cid and x.from_user <> uid), 0),
    'last_ping_received_at', greatest(
      (select max(p.created_at) from public.pings p where p.couple_id = cid and p.from_user <> uid),
      (select max(x.last_at) from public.ping_archive x where x.couple_id = cid and x.from_user <> uid)),
    'last_ping_sent_at', greatest(
      (select max(p.created_at) from public.pings p where p.couple_id = cid and p.from_user = uid),
      (select max(x.last_at) from public.ping_archive x where x.couple_id = cid and x.from_user = uid)),
    'my_answer', mine,
    'partner_answer', case when mine is null then null else (
      select jsonb_build_object('question_id', a.question_id, 'answer', a.answer, 'at', a.answered_at)
        from public.daily_answers a where a.couple_id = cid and a.user_id <> uid and a.day = p_day) end
  );
end $$;

-- get_month: come prima, ma i pensieri del mese contano anche l'archivio.
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
  -- i pensieri del mese = quelli ancora nella tabella + quelli già archiviati (vedi _prune_pings)
  pings := coalesce((select jsonb_object_agg(x.from_user::text, x.n) from (
    select u.from_user, sum(u.n)::int as n from (
      select from_user, count(*)::bigint as n from public.pings
       where couple_id = cid and (created_at at time zone 'Europe/Rome')::date >= first_day and (created_at at time zone 'Europe/Rome')::date < next_day
       group by from_user
      union all
      select from_user, n::bigint from public.ping_archive
       where couple_id = cid and month = first_day) u
     group by u.from_user) x), '{}'::jsonb);
  games := coalesce((select jsonb_object_agg(x.kind, x.n) from (
    select kind, count(*)::int as n from public.games
     where couple_id = cid and status = 'done' and (finished_at at time zone 'Europe/Rome')::date >= first_day and (finished_at at time zone 'Europe/Rome')::date < next_day
     group by kind) x), '{}'::jsonb);
  select count(*)::int into qa from (
    select a.day from public.qa_answers a where a.couple_id = cid and a.day >= first_day and a.day < next_day
     group by a.day having count(*) = 2) z;
  return jsonb_build_object('ok', true, 'year', p_year, 'month', p_month, 'moods', moods, 'pings', pings, 'games', games, 'qaBoth', qa);
end $$;

revoke all on function public.get_state(date, timestamptz) from public, anon;
grant execute on function public.get_state(date, timestamptz) to authenticated;
revoke all on function public.get_month(int, int) from public, anon;
grant execute on function public.get_month(int, int) to authenticated;

-- Una pulizia subito (idempotente: la seconda volta non trova più nulla).
select public._prune_pings();
