-- Fragolina · SOLO LA MIGRAZIONE DEI MINI GIOCHI (sessione 6). Generato da scripts/build-sql.mjs: non modificarlo a mano.
-- Incollalo nell'editor SQL di Supabase (SQL Editor → New query) e premi Run. Non tocca nulla di ciò che c'è già.
-- Si può rilanciare quante volte vuoi. Sotto "Success. No rows returned" = fatto.

-- Fragolina · migrazione 7 · mini giochi a due (sessione 6): Tris della fragola, Quanto mi conosci?, Disegna e indovina.
-- Idempotente: si può rieseguire senza danni. NON tocca nulla delle migrazioni 1-6.
--
--  • games         la partita (stato PUBBLICO calcolato dal server). Una sola aperta per gioco e per coppia.
--  • game_moves    le mosse, solo aggiunta (le risposte segrete del quiz NON ci sono).
--  • game_secrets  i segreti: risposte del quiz finché non hanno risposto entrambi, parola da disegnare. NESSUN client
--                  la legge e non è nel tempo reale: si rivelano solo dentro `games.data`, quando è il momento.
--  • game_scores   "Leonardo 7 – Nikole 9". • game_decks  quali domande/parole sono già uscite (mai ripetute).
-- Si scrive SOLO con le funzioni (start_game, game_move, abandon_game): nessuna scrittura diretta dai telefoni.
-- Le regole sono lo specchio di src/lib/games/reducer.ts (parità provata in tests/games.test.ts + sql-check).

create table if not exists public.games (
  id uuid primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('tris', 'quiz', 'draw')),
  status text not null default 'open' check (status in ('open', 'done', 'abandoned')),
  turn uuid,
  rev int not null default 1,
  data jsonb not null,
  result jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists games_one_open_idx on public.games (couple_id, kind) where status = 'open';
create index if not exists games_couple_created_idx on public.games (couple_id, created_at desc);

create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seq int not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  client_key text not null check (char_length(client_key) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index if not exists game_moves_game_idx on public.game_moves (game_id, seq);
create index if not exists game_moves_user_idx on public.game_moves (user_id, created_at desc);

create table if not exists public.game_secrets (
  game_id uuid not null references public.games(id) on delete cascade,
  key text not null,
  value text not null,
  primary key (game_id, key)
);

create table if not exists public.game_scores (
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('tris', 'quiz', 'draw')),
  user_id uuid not null,
  wins int not null default 0,
  draws int not null default 0,
  played int not null default 0,
  primary key (couple_id, kind, user_id)
);

create table if not exists public.game_decks (
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('quiz', 'draw')),
  used int[] not null default '{}',
  primary key (couple_id, kind)
);

-- ---------- Parole (specchio di src/lib/games/words.ts) ----------
create or replace function public._norm_word(t text) returns text
language plpgsql immutable as $$
declare s text := coalesce(t, '');
begin
  s := lower(translate(s, 'àáâäèéêëìíîïòóôöùúûüçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑ', 'aaaaeeeeiiiioooouuuucnaaaaeeeeiiiioooouuuucn'));
  s := regexp_replace(s, '[^a-z]+', ' ', 'g');
  s := btrim(s);
  s := regexp_replace(s, ' +', ' ', 'g');
  s := regexp_replace(s, '^(il|lo|la|le|i|gli|l|un|uno|una) (?=.)', '');
  return replace(s, ' ', '');
end $$;

create or replace function public._same_word(a text, b text) returns boolean
language plpgsql immutable as $$
declare x text := public._norm_word(a); y text := public._norm_word(b);
begin
  if x = '' or y = '' then return false; end if;
  if x = y then return true; end if;
  return char_length(x) >= 4 and char_length(y) >= 4
     and left(x, char_length(x) - 1) = left(y, char_length(y) - 1);
end $$;

-- ---------- Tris ----------
create or replace function public._tris_line(board text) returns int[]
language plpgsql immutable as $$
declare lines int[] := array[0,1,2, 3,4,5, 6,7,8, 0,3,6, 1,4,7, 2,5,8, 0,4,8, 2,4,6]; i int; a int; b int; c int; m text;
begin
  for i in 0..7 loop
    a := lines[i*3+1]; b := lines[i*3+2]; c := lines[i*3+3];
    m := substr(board, a + 1, 1);
    if m <> '-' and m = substr(board, b + 1, 1) and m = substr(board, c + 1, 1) then return array[a, b, c]; end if;
  end loop;
  return null;
end $$;

create or replace function public._ms(t timestamptz) returns bigint
language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function public._game_json(g public.games) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', g.id, 'kind', g.kind, 'status', g.status, 'turn', g.turn, 'rev', g.rev, 'data', g.data, 'result', g.result,
    'createdBy', g.created_by, 'createdAt', public._ms(g.created_at), 'updatedAt', public._ms(g.updated_at),
    'finishedAt', case when g.finished_at is null then null else public._ms(g.finished_at) end)
$$;

-- ---------- Applicazione di una mossa (specchio di applyMove in reducer.ts). Restituisce data/turn/status/result ----------
create or replace function public._game_apply(g public.games, uid uuid, other uuid, mv jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  d jsonb := g.data; t text := mv->>'type';
  cell int; board text; mark text; line int[]; x uuid; o uuid;
  q int; idx int; role text; sS int; sG int; ok boolean; k int; allrev boolean; sc int;
  word text; txt text; gs jsonb; nxt text;
begin
  if g.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'game_over'); end if;

  if g.kind = 'tris' and t = 'place' then
    if g.turn is distinct from uid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if jsonb_typeof(mv->'cell') <> 'number' or (mv->>'cell') !~ '^[0-8]$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    cell := (mv->>'cell')::int; board := d->>'board';
    if substr(board, cell + 1, 1) <> '-' then return jsonb_build_object('ok', false, 'error', 'cell_taken'); end if;
    x := (d->>'x')::uuid; o := (d->>'o')::uuid;
    mark := case when uid = x then 'X' else 'O' end;
    board := substr(board, 1, cell) || mark || substr(board, cell + 2);
    d := jsonb_set(d, '{board}', to_jsonb(board));
    line := public._tris_line(board);
    if line is not null then
      d := jsonb_set(d, '{win}', to_jsonb(line));
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done', 'result', jsonb_build_object('winner', uid));
    elsif position('-' in board) = 0 then
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done', 'result', jsonb_build_object('winner', null));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', case when uid = x then o else x end, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'quiz' and t = 'answer' then
    if jsonb_typeof(mv->'q') <> 'number' or (mv->>'q') !~ '^[0-4]$' or jsonb_typeof(mv->'idx') <> 'number' or (mv->>'idx') !~ '^[0-9]$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    q := (mv->>'q')::int; idx := (mv->>'idx')::int;
    role := case when (d->'subjects'->>q)::uuid = uid then 's' else 'g' end;
    if (d->'answered'->q->>role)::boolean then return jsonb_build_object('ok', false, 'error', 'already_answered'); end if;
    d := jsonb_set(d, array['answered', q::text, role], 'true'::jsonb);
    insert into public.game_secrets (game_id, key, value) values (g.id, 'q' || q || role, idx::text)
      on conflict (game_id, key) do nothing;
    if (d->'answered'->q->>'s')::boolean and (d->'answered'->q->>'g')::boolean then
      select value::int into sS from public.game_secrets where game_id = g.id and key = 'q' || q || 's';
      select value::int into sG from public.game_secrets where game_id = g.id and key = 'q' || q || 'g';
      ok := sS = sG;
      d := jsonb_set(d, array['reveals', q::text], jsonb_build_object('s', sS, 'g', sG, 'ok', ok));
      if ok then d := jsonb_set(d, '{score}', to_jsonb((d->>'score')::int + 1)); end if;
    end if;
    allrev := true;
    for k in 0..4 loop
      if jsonb_typeof(d->'reveals'->k) <> 'object' then allrev := false; end if;
    end loop;
    if allrev then
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done',
        'result', jsonb_build_object('score', (d->>'score')::int, 'total', 5));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'draw' and t = 'drawing' then
    if uid <> (d->>'drawer')::uuid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if d->>'phase' <> 'drawing' then return jsonb_build_object('ok', false, 'error', 'wrong_phase'); end if;
    if not public._note_valid('draw', mv->'content') then return jsonb_build_object('ok', false, 'error', 'invalid_content'); end if;
    d := jsonb_set(jsonb_set(d, '{drawing}', mv->'content'), '{phase}', '"guessing"'::jsonb);
    return jsonb_build_object('ok', true, 'data', d, 'turn', (d->>'guesser')::uuid, 'status', 'open', 'result', null);
  end if;

  if g.kind = 'draw' and t = 'guess' then
    if uid <> (d->>'guesser')::uuid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    if d->>'phase' <> 'guessing' then return jsonb_build_object('ok', false, 'error', 'wrong_phase'); end if;
    txt := btrim(coalesce(mv->>'text', ''));
    if jsonb_typeof(mv->'text') <> 'string' or char_length(txt) < 1 or char_length(txt) > 40 then
      return jsonb_build_object('ok', false, 'error', 'invalid_move'); end if;
    select value into word from public.game_secrets where game_id = g.id and key = 'word';
    ok := public._same_word(txt, coalesce(word, ''));
    d := jsonb_set(d, '{guesses}', (d->'guesses') || jsonb_build_array(jsonb_build_object('by', uid, 'text', txt, 'ok', ok)));
    if ok or jsonb_array_length(d->'guesses') >= 3 then
      d := jsonb_set(jsonb_set(d, '{phase}', '"done"'::jsonb), '{word}', to_jsonb(coalesce(word, '')));
      return jsonb_build_object('ok', true, 'data', d, 'turn', null, 'status', 'done',
        'result', jsonb_build_object('solved', ok, 'attempts', jsonb_array_length(d->'guesses'), 'word', coalesce(word, '')));
    end if;
    return jsonb_build_object('ok', true, 'data', d, 'turn', (d->>'guesser')::uuid, 'status', 'open', 'result', null);
  end if;

  return jsonb_build_object('ok', false, 'error', 'invalid_move');
end $$;

-- Punteggi a fine partita (specchio di scoreDelta in reducer.ts).
create or replace function public._game_score(g public.games, a uuid, b uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare u uuid; w int := 0; dr int := 0; pl int := 1; winner uuid;
begin
  if g.status <> 'done' then return; end if;
  foreach u in array array[a, b] loop
    w := 0; dr := 0; pl := 1;
    if g.kind = 'tris' then
      winner := nullif(g.result->>'winner', '')::uuid;
      if winner is null then dr := 1; elsif winner = u then w := 1; end if;
    elsif g.kind = 'quiz' then
      w := (g.result->>'score')::int; pl := 5;
    else
      if (g.result->>'solved')::boolean then w := 1; end if;
    end if;
    insert into public.game_scores (couple_id, kind, user_id, wins, draws, played) values (g.couple_id, g.kind, u, w, dr, pl)
    on conflict (couple_id, kind, user_id) do update set
      wins = public.game_scores.wins + excluded.wins, draws = public.game_scores.draws + excluded.draws,
      played = public.game_scores.played + excluded.played;
  end loop;
end $$;

-- ---------- RPC ----------
create or replace function public.start_game(p_id uuid, p_kind text, p_params jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); cid uuid; other uuid; ex public.games; last public.games; g public.games;
  d jsonb; turn uuid; first uuid; second uuid; x uuid; o uuid; word text; qids jsonb; i int; reset boolean;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_id is null or p_kind is null or p_kind not in ('tris', 'quiz', 'draw') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  if other is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;

  select * into ex from public.games where id = p_id;
  if found then
    if ex.couple_id <> cid then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(ex));
  end if;
  select * into ex from public.games where couple_id = cid and kind = p_kind and status = 'open';
  if found then return jsonb_build_object('ok', false, 'error', 'game_open', 'game', public._game_json(ex)); end if;
  if (select count(*) from public.game_moves where user_id = uid and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  select * into last from public.games where couple_id = cid and kind = p_kind order by created_at desc limit 1;
  p_params := coalesce(p_params, '{}'::jsonb);

  if p_kind = 'tris' then
    x := case when not found or last.id is null then uid when (last.data->>'x')::uuid = uid then other else uid end;
    o := case when x = uid then other else uid end;
    d := jsonb_build_object('x', x, 'o', o, 'board', '---------', 'win', null);
    turn := x;
  elsif p_kind = 'quiz' then
    qids := p_params->'qids';
    if jsonb_typeof(qids) <> 'array' or jsonb_array_length(qids) <> 5 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    for i in 0..4 loop
      if jsonb_typeof(qids->i) <> 'number' or (qids->>i) !~ '^[0-9]{1,3}$' then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    end loop;
    if (select count(distinct v) from jsonb_array_elements_text(qids) v) <> 5 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    first := case when last.id is null then uid when (last.data->'subjects'->>0)::uuid = uid then other else uid end;
    second := case when first = uid then other else uid end;
    d := jsonb_build_object('qids', qids,
      'subjects', jsonb_build_array(first, second, first, second, first),
      'answered', jsonb_build_array(jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false),
        jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false), jsonb_build_object('s', false, 'g', false)),
      'reveals', jsonb_build_array(null, null, null, null, null), 'score', 0);
    turn := null;
  else
    word := btrim(coalesce(p_params->>'word', ''));
    if char_length(word) < 2 or char_length(word) > 40 then return jsonb_build_object('ok', false, 'error', 'invalid_game'); end if;
    if last.id is not null and (last.data->>'drawer')::uuid = uid then return jsonb_build_object('ok', false, 'error', 'not_your_turn'); end if;
    d := jsonb_build_object('drawer', uid, 'guesser', other, 'phase', 'drawing', 'drawing', null, 'guesses', '[]'::jsonb, 'word', null);
    turn := uid;
  end if;

  insert into public.games (id, couple_id, kind, turn, data, created_by) values (p_id, cid, p_kind, turn, d, uid) returning * into g;
  if p_kind = 'draw' then insert into public.game_secrets (game_id, key, value) values (g.id, 'word', word); end if;
  -- mazzo: quali domande/parole sono già uscite (il telefono sceglie fra le altre; `reset` ricomincia dal mazzo pieno)
  if p_kind = 'quiz' or (p_kind = 'draw' and jsonb_typeof(p_params->'wordId') = 'number') then
    reset := coalesce((p_params->>'reset')::boolean, false);
    insert into public.game_decks (couple_id, kind, used)
    values (cid, p_kind, case when p_kind = 'quiz' then array(select (v)::int from jsonb_array_elements_text(qids) v) else array[(p_params->>'wordId')::int] end)
    on conflict (couple_id, kind) do update set used = case
      when reset then excluded.used
      else array(select distinct u from unnest(public.game_decks.used || excluded.used) u order by u) end;
  end if;
  return jsonb_build_object('ok', true, 'game', public._game_json(g));
end $$;

create or replace function public.game_move(p_game uuid, p_move jsonb, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; other uuid; g public.games; r jsonb; dup public.game_moves; nw public.games; seq int; pay jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_game is null or p_move is null or jsonb_typeof(p_move) <> 'object' or p_client_key is null or char_length(p_client_key) not between 8 and 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_action'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select user_id into other from public.couple_members where couple_id = cid and user_id <> uid;
  select * into dup from public.game_moves where user_id = uid and client_key = p_client_key;
  if found then
    select * into g from public.games where id = dup.game_id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(g));
  end if;
  select * into g from public.games where id = p_game and couple_id = cid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_game'); end if;
  if other is null then return jsonb_build_object('ok', false, 'error', 'no_partner'); end if;
  if (select count(*) from public.game_moves where user_id = uid and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  r := public._game_apply(g, uid, other, p_move);
  if (r->>'ok')::boolean is not true then return r; end if;
  update public.games set data = r->'data', turn = nullif(r->>'turn', '')::uuid, status = r->>'status', result = r->'result',
    rev = rev + 1, updated_at = now(), finished_at = case when r->>'status' = 'done' then now() else null end
  where id = g.id returning * into nw;
  seq := coalesce((select max(m.seq) from public.game_moves m where m.game_id = g.id), 0) + 1;
  pay := case when p_move->>'type' = 'answer' then jsonb_build_object('type', 'answer', 'q', p_move->'q') else p_move end;
  insert into public.game_moves (game_id, couple_id, user_id, seq, kind, payload, client_key) values (g.id, cid, uid, seq, p_move->>'type', pay, p_client_key);
  if nw.status = 'done' then perform public._game_score(nw, uid, other); end if;
  return jsonb_build_object('ok', true, 'game', public._game_json(nw), 'finished', nw.status = 'done');
end $$;

create or replace function public.abandon_game(p_game uuid, p_client_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; g public.games; seq int;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  select * into g from public.games where id = p_game and couple_id = cid for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_game'); end if;
  if g.status <> 'open' then return jsonb_build_object('ok', true, 'duplicate', true, 'game', public._game_json(g)); end if;
  update public.games set status = 'abandoned', turn = null, rev = rev + 1, updated_at = now(), finished_at = now(),
    result = jsonb_build_object('by', uid) where id = g.id returning * into g;
  seq := coalesce((select max(m.seq) from public.game_moves m where m.game_id = g.id), 0) + 1;
  insert into public.game_moves (game_id, couple_id, user_id, seq, kind, payload, client_key)
  values (g.id, cid, uid, seq, 'abandon', '{}'::jsonb, 'abandon-' || g.id::text)
  on conflict (user_id, client_key) do nothing;
  return jsonb_build_object('ok', true, 'game', public._game_json(g));
end $$;

-- Tutto per l'app in una chiamata: partite (aperte + l'ultima chiusa di ogni gioco + gli ultimi 12 disegni = l'album), punteggi, mazzi, i MIEI segreti.
create or replace function public.get_games() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; games jsonb := '[]'::jsonb; scores jsonb := '{}'::jsonb; decks jsonb := '{}'::jsonb; mine jsonb := '{}'::jsonb;
  r public.games; s record; sec jsonb; role text; k text; qs jsonb; qk jsonb;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select couple_id into cid from public.couple_members where user_id = uid;
  if cid is null then return jsonb_build_object('ok', false, 'error', 'not_paired'); end if;
  for r in
    select g.* from public.games g where g.couple_id = cid and (g.status = 'open' or g.id in (
      select distinct on (kind) id from public.games where couple_id = cid and status <> 'open' order by kind, created_at desc)
      or g.id in (select id from public.games where couple_id = cid and kind = 'draw' and status = 'done' order by created_at desc limit 12))
    order by g.created_at desc
  loop
    games := games || jsonb_build_array(public._game_json(r));
    sec := '{}'::jsonb;
    if r.kind = 'quiz' then
      for s in select key, value from public.game_secrets where game_id = r.id and key ~ '^q[0-4][sg]$' loop
        k := substr(s.key, 2, 1); role := substr(s.key, 3, 1);
        if (r.data->'subjects'->>(k::int))::uuid = uid and role = 's' or (r.data->'subjects'->>(k::int))::uuid <> uid and role = 'g' then
          qs := coalesce(sec->'qs', '{}'::jsonb);
          qk := coalesce(qs->k, '{}'::jsonb) || jsonb_build_object(role, s.value::int);
          sec := jsonb_build_object('qs', qs || jsonb_build_object(k, qk));
        end if;
      end loop;
    elsif r.kind = 'draw' and (r.data->>'drawer')::uuid = uid then
      sec := jsonb_build_object('word', (select value from public.game_secrets where game_id = r.id and key = 'word'));
    end if;
    if sec <> '{}'::jsonb then mine := jsonb_set(mine, array[r.id::text], sec, true); end if;
  end loop;
  scores := coalesce((select jsonb_object_agg(x.kind, x.m) from (
    select kind, jsonb_object_agg(user_id::text, jsonb_build_object('wins', wins, 'draws', draws, 'played', played)) as m
    from public.game_scores where couple_id = cid group by kind) x), '{}'::jsonb);
  for s in select kind, used from public.game_decks where couple_id = cid loop
    decks := jsonb_set(decks, array[s.kind], to_jsonb(s.used), true);
  end loop;
  return jsonb_build_object('ok', true, 'games', games, 'scores', scores, 'decks', decks, 'mine', mine);
end $$;

-- ---------- Privilegi e RLS ----------
revoke all on public.games, public.game_moves, public.game_secrets, public.game_scores, public.game_decks from anon, authenticated;
grant select on public.games, public.game_moves, public.game_scores to authenticated;
alter table public.games enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_decks enable row level security;

drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists game_moves_select on public.game_moves;
create policy game_moves_select on public.game_moves for select to authenticated using (couple_id = public.my_couple_id());
drop policy if exists game_scores_select on public.game_scores;
create policy game_scores_select on public.game_scores for select to authenticated using (couple_id = public.my_couple_id());
-- game_secrets e game_decks: nessuna policy e nessun privilegio (solo le funzioni security definer le toccano).

revoke all on function public._norm_word(text) from public, anon, authenticated;
revoke all on function public._same_word(text, text) from public, anon, authenticated;
revoke all on function public._tris_line(text) from public, anon, authenticated;
revoke all on function public._game_json(public.games) from public, anon, authenticated;
revoke all on function public._game_apply(public.games, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._game_score(public.games, uuid, uuid) from public, anon, authenticated;
revoke all on function public.start_game(uuid, text, jsonb) from public, anon;
revoke all on function public.game_move(uuid, jsonb, text) from public, anon;
revoke all on function public.abandon_game(uuid, text) from public, anon;
revoke all on function public.get_games() from public, anon;
grant execute on function public.start_game(uuid, text, jsonb) to authenticated;
grant execute on function public.game_move(uuid, jsonb, text) to authenticated;
grant execute on function public.abandon_game(uuid, text) to authenticated;
grant execute on function public.get_games() to authenticated;

-- ---------- Tempo reale (solo `games`: lo stato pubblico; i segreti non ci passano mai) ----------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;
