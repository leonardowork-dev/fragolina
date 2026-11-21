-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 11: codice di recupero del posto (cambio di identità del telefono).
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Rieseguibile.

-- Sessione 11: codice di recupero del posto. Serve quando un telefono cambia identità (nuova installazione con un altro
-- metodo di firma, portachiavi perso): il vecchio membro genera un codice PRIMA, il nuovo accesso anonimo lo riscatta e
-- prende il posto (tutte le righe del vecchio utente passano al nuovo). Codice a uso singolo, salvato solo come hash,
-- scade dopo 14 giorni, tentativi limitati. Tabella senza policy: si passa solo dalle funzioni.

create table if not exists public.recovery_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;

create or replace function public.create_recovery_code() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid(); cid uuid; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; raw text := ''; i int; b bytea;
  exp timestamptz := now() + interval '14 days';
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  if (select count(*) from public.rate_events where kind = 'recovery_new' and user_id = uid and at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.rate_events (kind, user_id) values ('recovery_new', uid);
  b := gen_random_bytes(12);
  for i in 0..11 loop raw := raw || substr(alphabet, (get_byte(b, i) % 31) + 1, 1); end loop;
  insert into public.recovery_codes (user_id, couple_id, code_hash, expires_at)
  values (uid, cid, encode(digest(raw, 'sha256'), 'hex'), exp)
  on conflict (user_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, created_at = now(), couple_id = excluded.couple_id;
  return jsonb_build_object('ok', true, 'code', substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4),
    'expires_at', (extract(epoch from exp) * 1000)::bigint);
end $$;

-- Il nuovo accesso anonimo (senza coppia) riscatta il codice e prende il posto del vecchio membro.
create or replace function public.redeem_recovery_code(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid(); norm text; rec public.recovery_codes; r record; role_ text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if exists (select 1 from public.couple_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'already_paired');
  end if;
  if (select count(*) from public.rate_events where kind = 'recovery_fail' and user_id = uid and at > now() - interval '10 minutes') >= 5
     or (select count(*) from public.rate_events where kind = 'recovery_fail' and at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  select * into rec from public.recovery_codes where code_hash = encode(digest(norm, 'sha256'), 'hex') and expires_at > now();
  if not found or char_length(norm) <> 12 then
    insert into public.rate_events (kind, user_id) values ('recovery_fail', uid);
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;
  if rec.user_id = uid then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  -- il posto passa al nuovo utente: ogni colonna che punta a auth.users(id) in public viene riassegnata
  delete from public.recovery_codes where user_id = rec.user_id;
  for r in
    select k.conrelid::regclass::text as t, a.attname::text as c
      from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
     where k.contype = 'f' and k.confrelid = 'auth.users'::regclass and k.connamespace = 'public'::regnamespace
       and array_length(k.conkey, 1) = 1
  loop
    execute format('update %s set %I = $1 where %I = $2', r.t, r.c, r.c) using uid, rec.user_id;
  end loop;
  select role into role_ from public.couple_members where user_id = uid;
  return jsonb_build_object('ok', true, 'role', role_, 'couple_id', rec.couple_id);
end $$;

revoke all on function public.create_recovery_code() from public, anon;
revoke all on function public.redeem_recovery_code(text) from public, anon;
grant execute on function public.create_recovery_code() to authenticated;
grant execute on function public.redeem_recovery_code(text) to authenticated;
