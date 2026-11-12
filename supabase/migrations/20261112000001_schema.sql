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
