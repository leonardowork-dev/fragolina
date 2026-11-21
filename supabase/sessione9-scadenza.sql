-- Fragolina · SOLO LA MIGRAZIONE DELLA SESSIONE 9: scadenza dell'app (Apple ID gratuito, 7 giorni), scritta da ciascuno e letta dall'altro.
-- Generato da scripts/build-sql.mjs: non modificarlo a mano. Due colonne nuove su couple_members e due funzioni. Rieseguibile.

-- Sessione 9: scadenza dell'app (Apple ID gratuito = 7 giorni). Ognuno scrive la PROPRIA scadenza, l'altro la legge.
-- Nessuna tabella nuova: due colonne su couple_members. Nessun dato sensibile: una data.

alter table public.couple_members add column if not exists app_expires_at timestamptz;
alter table public.couple_members add column if not exists app_expires_reported_at timestamptz;

-- Scrivo la scadenza del MIO telefono (data del provisioning profile). Ritorna ok sempre che io sia in una coppia.
-- Fuori finestra (più di 1 giorno nel passato o più di 400 giorni nel futuro) = invalid_content: orologio o profilo strani.
create or replace function public.set_app_expiry(p_at bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); t timestamptz;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if not exists (select 1 from public.couple_members where user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'not_paired');
  end if;
  if p_at is null or p_at < 1577836800000 or p_at > 4102444800000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  t := to_timestamp(p_at / 1000.0);
  if t < now() - interval '1 day' or t > now() + interval '400 days' then
    return jsonb_build_object('ok', false, 'error', 'invalid_content');
  end if;
  update public.couple_members
     set app_expires_at = t, app_expires_reported_at = now()
   where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- La scadenza dell'ALTRA persona (se l'ha mai scritta). Solo chi è nella stessa coppia.
create or replace function public.get_partner_expiry() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; m record;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select display_name, app_expires_at, app_expires_reported_at into m
    from public.couple_members where couple_id = cid and user_id <> uid;
  if not found then return jsonb_build_object('ok', true, 'partner', null); end if;
  return jsonb_build_object('ok', true, 'partner', jsonb_build_object(
    'name', m.display_name,
    'expiresAt', case when m.app_expires_at is null then null else (extract(epoch from m.app_expires_at) * 1000)::bigint end,
    'reportedAt', case when m.app_expires_reported_at is null then null else (extract(epoch from m.app_expires_reported_at) * 1000)::bigint end
  ));
end $$;

revoke all on function public.set_app_expiry(bigint) from public, anon;
revoke all on function public.get_partner_expiry() from public, anon;
grant execute on function public.set_app_expiry(bigint) to authenticated;
grant execute on function public.get_partner_expiry() to authenticated;
