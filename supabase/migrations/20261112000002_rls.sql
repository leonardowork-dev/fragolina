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
