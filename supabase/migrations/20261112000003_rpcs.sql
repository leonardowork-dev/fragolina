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
