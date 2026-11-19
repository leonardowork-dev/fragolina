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
