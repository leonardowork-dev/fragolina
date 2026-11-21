# Backend (Supabase, piano gratuito)

Due persone, nessuna registrazione pubblica, nessuna email/telefono/login esterno. Ogni telefono entra con un **accesso anonimo** di Supabase (disponibile nel piano Free: verificato nella documentazione ufficiale il 12/11/2026; limite predefinito 30 accessi anonimi all'ora per indirizzo IP, modificabile in Authentication → Rate Limits). L'identità vive nella sessione salvata in `expo-secure-store`.

## File
| File | A cosa serve |
|---|---|
| `supabase/migrations/*.sql` | Versioni numerate, idempotenti (si possono rieseguire). |
| `supabase/all.sql` | Le stesse, in un file solo, da incollare nell'editor SQL. Si rigenera con `npm run backend:sql`. |
| `scripts/sql-check.mjs` | Prova **vera** di `all.sql` su un Postgres locale (PGlite): 60 controlli su RLS, RPC, limiti. `npm run backend:sqltest`. |
| `scripts/backend-check.mjs` | Collaudo end-to-end sul progetto vero con due telefoni finti + un terzo + uno sconosciuto. Senza chiavi fa la prova a secco. |

## Modello dei dati
`couples` (codice d'invito, data d'inizio) · `couple_members` (massimo 2: ruolo `a`/`b`, vincolo + trigger) · `mood_events` · `pings` (solo aggiunta) · `daily_answers` (una per persona al giorno, non modificabile). Tabelle interne senza alcuna policy (invisibili ai client): `app_settings`, `rate_events`.

## Funzioni (RPC), tutte `security definer` con `search_path` fissato
`create_couple`, `join_couple`, `leave_couple`, `renew_join_code`, `release_partner`, `set_start_date`, `set_display_name`, `get_state`. Rispondono `{ok:true,…}` oppure `{ok:false,error:'…'}` (non eccezioni, così i tentativi falliti restano registrati). Errori: `invalid_code`, `code_expired`, `couple_full`, `already_paired`, `not_paired`, `rate_limited`, `closed`, `name_required`, `invalid_date`, `no_partner`.

- **Codice**: 6 caratteri da `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (niente I, L, O, 0, 1), generato con `gen_random_bytes` (pgcrypto). Vale 24 ore e si consuma quando entra la seconda persona. Scaduto? `renew_join_code`.
- **Ordine di unione**: il secondo posto si prende con `join_couple`; non esiste altro modo di diventare membro (nessun insert diretto, nessuna policy di scrittura su `couple_members` e `couples`).
- **Risposte del giorno**: la RLS nasconde la risposta del partner finché non hai risposto tu allo stesso giorno (funzione `i_answered`). `get_state` applica la stessa regola a mano.

## Cosa può e non può fare chi ha la chiave pubblica (threat model in parole semplici)
La chiave `anon` è nell'app, quindi **chiunque la può estrarre**. È normale: la sicurezza non sta nella chiave ma nelle regole del database (RLS).

**Senza sessione** (solo chiave): non legge nulla, non scrive nulla, non può chiamare nessuna funzione. Può soltanto chiedere a Supabase un accesso anonimo.

**Con un accesso anonimo qualsiasi** (uno sconosciuto che lo crea da sé):
- *Non può* leggere umori, pensieri, risposte, nomi o la data di nessuna coppia: ogni tabella mostra solo le righe della **propria** coppia, e uno sconosciuto non ne ha.
- *Non può* scrivere nella vostra coppia, né spacciarsi per voi (le scritture richiedono `user_id = utente corrente` e coppia = la sua).
- *Non può* entrare: servirebbe indovinare un codice tra circa 887 milioni; è valido solo finché una persona aspetta (max 24 ore), e dopo 5 errori in 10 minuti (60 in totale) viene fermato. Anche un codice giusto, mentre è bloccato, viene rifiutato.
- *Non può* diventare il terzo membro: massimo due, per vincolo, per trigger e per la funzione.
- *Può* creare una coppia tutta sua (non vi tocca): limitato a 3 al giorno per persona e 20 all'ora in tutto. Può quindi riempire un po' il database con righe inutili (500 MB nel piano Free). Le coppie abbandonate si cancellano da sole dopo 7 giorni. **Chiusura opzionale**: dopo che vi siete collegati, `insert into app_settings values ('closed','true');` nell'editor SQL impedisce a chiunque di creare nuove coppie (le due persone esistenti non sono toccate).
- *Può* consumare accessi anonimi (30/ora per IP): è il massimo che Supabase concede senza CAPTCHA. Non c'è un CAPTCHA (richiederebbe un servizio terzo e una pagina web): rischio accettato per un'app privata, registrato in `IMPROVEMENTS.md`.

**Con la sessione di una delle due persone**: vede e scrive solo la vostra coppia. Non può cambiare la risposta già data, né quella dell'altra; i timestamp scelti dal telefono non possono stare nel futuro; massimo 30 pensieri o umori al minuto.

**Limiti onesti**
- La sessione anonima è legata al telefono: se si cancella l'app *e* il portachiavi, l'identità è persa. Il posto resta occupato, ma l'altra persona può liberarlo con "ha cambiato telefono" (`release_partner`) e ricollegarsi con un codice nuovo.
- Il "chi è collegato" non è un segreto crittografico: chi ottiene il telefono sbloccato di una delle due persone entra come lei.
- Dati in chiaro nel database Supabase (non cifrati end-to-end): chi amministra il progetto (voi) li può leggere.
- Eventi di cancellazione non arrivano in tempo reale (limite di Supabase con la RLS): l'app si risincronizza ogni 45 secondi e quando torna in primo piano.

## Realtime
Publication `supabase_realtime`: `pings`, `mood_events`, `daily_answers`, `couples`, **`couple_members`** (aggiunta oltre alle quattro richieste: serve alla persona A per accorgersi quando B entra). Le notifiche rispettano la RLS (ognuno riceve solo gli eventi della sua coppia).

## Cosa fa il client al posto del server
Idempotenza (`client_key` unica per persona: un invio ripetuto dopo un errore di rete non duplica), coda offline, ritentativi con backoff. Vedi `src/lib/sync`.


## Sessione 5: biglietti, distanza e accesso del widget (migrazione `20261114000001_note.sql`)
File da incollare: `supabase/sessione5-note.sql` (solo questa migrazione; rieseguibile).

**Tabelle:** `notes` (biglietti: tipo `draw|text`, contenuto `jsonb`, autore, `expires_at` = +1 h, `cleared_at/by`; storico di 30 per coppia), `locations` (UNA riga per persona: consenso `sharing`, ultima posizione in centesimi di grado, `at`), `widget_tokens` (UNA riga per persona: hash sha256 del token). RLS: `notes` visibile ai due membri; `locations` visibile a te e, solo se condividi anche tu, all'altra persona (consenso reciproco anche nel tempo reale); `widget_tokens` senza nessuna policy né privilegio. Nessuna scrittura diretta.

**Funzioni (tutte `security definer`, `search_path` fissato):** `send_note` (idempotente per chiave client, validazione di forma e dimensione, 20/min), `clear_note(id)`, `get_board` (ultimo biglietto + posizioni), `set_location_sharing`, `set_location` (ultima scrittura vince, mai nel futuro, 30/min), `rotate_widget_token`, `widget_feed(token)`, `widget_set_location(token, …)`. Errori nuovi: `invalid_content`, `not_sharing`, `invalid_location`, `invalid_token`. Le funzioni interne (`_note_valid`, `_loc_state`, `_set_location`, `_token_user`…) non sono chiamabili dai client.

**Modello di sicurezza del token del widget (parole semplici):**
- Il widget è un programma a parte: non può usare la sessione dell'app. Quindi ha un *suo* segreto: 32 byte casuali (64 caratteri esadecimali) generati dal server, mostrati **una volta sola** all'app e salvati nel database solo come hash. Se il database venisse letto, i token non si ricaverebbero.
- L'app scrive nello snapshot dell'App Group: URL del progetto, chiave **pubblica** e token. Mai la `service_role` (non esiste nell'app né nell'IPA; controllato).
- Con la chiave pubblica + un token valido si può chiamare **solo** `widget_feed` (legge: ora del server, biglietto attivo, nome e posizione arrotondata dell'altra persona se vi siete dati il consenso) e `widget_set_location` (scrive: la tua posizione arrotondata, solo se hai acceso la condivisione). Niente altro: né tabelle, né altre funzioni.
- Indovinare un token è impossibile (2^256). I tentativi sbagliati si registrano con un tetto di 60 al minuto in tutto (il registro non cresce all'infinito) e **non bloccano mai i token validi**. Un token valido ha 240 richieste/ora.
- Revoca: ruotando il token il vecchio smette subito; chi esce dalla coppia (o viene liberato da "ha cambiato telefono") perde token e posizione (trigger `couple_members_cleanup`). Il feed risponde `invalid_token` e il widget si svuota.
- **Limiti onesti:** chi ottiene il telefono sbloccato (o il contenuto dell'App Group) ha il token; il token sta nell'App Group in chiaro come il resto dello snapshot; i dati dei biglietti sono in chiaro nel database (non cifrati end-to-end).

**Posizione:** si scambiano solo interi `latE2/lonE2` (gradi × 100 ≈ 1 km); il telefono arrotonda prima di inviare (`roundE2`) e il server rifiuta valori fuori scala. Si salva solo l'ultima posizione; spegnendo la condivisione il server cancella anche quella. La distanza (haversine) la calcola chi guarda.

**Tempo reale:** publication aggiornata con `notes` e `locations` (canale a parte `board-…`: se la migrazione manca non fa cadere il resto).


## Sessione 7: eventi, domanda del giorno, ricordi, Storage (migrazione `20261119000001_extra7.sql`)
File da incollare: `supabase/sessione7-extra.sql` (rieseguibile; crea anche il bucket privato `memories` e le sue regole).

**Tabelle:** `countdown_events` (eventi, last-write-wins per `at`), `qa_days` (la domanda di ogni giorno di Roma, fissata dal primo che la apre), `qa_answers` ("ha risposto": chi e quando, nel realtime), `qa_texts` (il TESTO: **segreto**, RLS + funzioni, **non** nel realtime), `memories` (foto e biglietti/disegni tenuti). Nessuna scrittura diretta: solo le funzioni `upsert_event`, `delete_event`, `answer_qa`, `set_tomorrow_question`, `add_memory`, `delete_memory`; letture con `get_events`, `get_qa`, `get_memories`, `get_month`.

**Il segreto della domanda (parole semplici):** l'altra persona vede il tuo testo solo dopo aver risposto lei allo stesso giorno. È garantito in due modi: la regola della tabella (`qa_texts_select`: o è la tua riga, o hai già risposto tu a quel giorno) e `get_qa`, che manda il testo dell'altro solo a chi ha risposto. Nel tempo reale passa soltanto `qa_answers` ("Nikole ha risposto"); quando risponde il secondo, il primo rilegge e il testo gli arriva da `get_qa`. Chi non è in coppia non vede nulla.

**Storage:** bucket `memories` privato (solo JPEG, max 1 MB). Percorso `<id coppia>/<id ricordo>.jpg`. Regole su `storage.objects`: `memories_read`/`memories_write` = solo i due membri, solo nella cartella della propria coppia; `memories_remove` = solo chi ha caricato il file. Si vedono le foto con URL firmati a scadenza breve (10 minuti); l'indirizzo pubblico non le serve. `add_memory` rifiuta percorsi di un'altra coppia o file che non esistono. Il file va tolto dallo Storage dal telefono dopo `delete_memory` (cancellare la riga di `storage.objects` da SQL non cancellerebbe il file).

**`widget_feed`** ora restituisce anche `events` (≤ 5, in-evidenza per primo): stessa porta (chiave pubblica + token a 256 bit), niente altro è uscito (le risposte della domanda non sono nel feed: provato).

**Giorno:** `_rome_day()` = Europe/Rome per entrambi. **Errori nuovi:** `not_your_turn` (domani scrive l'altro), `not_yours` (un ricordo lo toglie chi l'ha aggiunto), `no_file` (la foto non è ancora nello Storage).

**Migrazione delle risposte a/b** (`daily_answers` → `qa_answers`/`qa_texts` con `choice`): nessuna risposta persa, segreto invariato; la vecchia tabella resta.

**Spazio (piano gratuito):** 1 GB di Storage ≈ 2600 foto da 400 KB (≈ 2100 al tetto di 500 KB); le foto non occupano il database (500 MB).

## Zona privata (sessione 10) — modello dei dati e privacy
Tabelle `z_entries` (cuoricini), `z_ideas` (idee scritte da voi), `z_wishes` (desideri scelti), `z_tonight` ("stasera?"), `z_signals` ("ho voglia"), `z_vouchers` (buoni), `z_pulse` (contatore). **RLS attiva, nessuna policy, nessun privilegio ai client**: si legge e si scrive solo con le funzioni `z_get`, `z_log`, `z_log_delete`, `z_wish`, `z_idea_add/delete`, `z_tonight`, `z_signal(_clear)`, `z_voucher_add/redeem/delete`, `z_wipe` (security definer, solo membri della coppia; anon senza accesso).
- **Segreti:** `z_get` restituisce MAI le scelte dell'altro: solo le tue (`wishesMine`) e i `matches` (idee scelte da entrambi). "Stasera?": l'altro vede solo "ha risposto"; l'esito (`match` se sì+sì o sì+forse, altrimenti `nomatch`) esce solo quando hanno risposto entrambi e dopo non si cambia più. Le idee scritte da voi sono carte visibili a entrambi senza autore (chi la scrive la sceglie in automatico).
- **Realtime:** nella publication c'è SOLO `z_pulse` (un numero e un orario, nessun contenuto): il telefono rilegge con `z_get` quando cambia. Il contatore non cambia se scegli un desiderio che l'altro non ha scelto.
- **Fuori dalla zona:** `widget_feed`, `get_state`, snapshot del widget, Ricordi, "Il nostro mese" non toccano queste tabelle (provato in `backend:sqltest` e `backend:check`). L'avviso del "ho voglia" è solo "X ti ha mandato una fragola".
- **Cancella tutto:** `z_wipe` svuota tutte le tabelle z_* della coppia. Chi esce dalla coppia porta via desideri, risposte e segnali (trigger `tg_z_member_cleanup`).
