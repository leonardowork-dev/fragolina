-- Fragolina · migrazione 4 · Realtime (publication supabase_realtime).
-- Oltre a pings, mood_events, daily_answers e couples c'è couple_members: serve alla persona A
-- per accorgersi nell'istante in cui B entra con il codice.
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['pings', 'mood_events', 'daily_answers', 'couples', 'couple_members'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
