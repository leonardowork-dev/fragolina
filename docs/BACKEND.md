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
