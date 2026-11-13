# IMPROVEMENTS.md — backlog (dopo il lancio)
Una riga per idea. Niente da fare in sessione 2 se non è qui sotto già fatto.

- Prune dei `pings` più vecchi di 90 giorni (job pg_cron o funzione chiamata da `get_state`) per restare sotto i 500 MB del piano gratuito.
- CAPTCHA/Turnstile sugli accessi anonimi (oggi: solo il limite di 30/ora per IP di Supabase).
- Notifiche push vere (richiedono account Apple a pagamento + APNs): oggi niente; alternativa gratuita: Percorso B del widget (fetch) per aggiornarlo senza aprire l'app.
- Realtime delle cancellazioni (`member-left`): oggi si scopre con la risincronizzazione (45 s o primo piano); si potrebbe usare un canale Broadcast.
- `expo-network` per sapere subito quando torna la rete (oggi: backoff 1→30 s).
- Domanda del giorno: banca da 24 domande in `strings.it.ts`; aggiungerne e un editor "scrivi tu la domanda per domani".
- Cambio di fuso orario fra i due telefoni: il "giorno" è quello del telefono; se uno viaggia le domande possono slittare di un giorno.
- Esportazione/ricordi: storico degli umori (la tabella `mood_events` lo conserva già) con una pagina "il nostro mese".
- Backup dei dati (un'esportazione JSON dal telefono) prima di `leave_couple`, che cancella tutto.
- Test E2E su Supabase vero in CI (oggi `npm run backend:check` lo si lancia a mano con le chiavi).
- Widget "Domanda del giorno": il dato (`questionText`, `questionMineDone`, `questionBothDone`) è già nello snapshot v3, manca la grafica.
- Widget con la vostra foto o il disegno del giorno (sessione 5, Doodle → widget).
- Le otto facce degli umori con i vostri disegni (`sticker-N.png`) anche nei widget: oggi sono fragole disegnate nel codice.
- Mesiversari personalizzati (date speciali oltre alla data d'inizio) con una seconda data nello snapshot.
- Widget interattivo su iOS 17+ (bottone "Penso a te" senza aprire l'app) con `if #available` e ripiego sul link; richiede un AppIntent nell'app.
- Generare lo snapshot di prova per l'anteprima web direttamente da `tests/fixtures` (oggi i casi sono scritti in `WidgetPreview.tsx`).
- Lock screen: scelta "giorni/faccina" dentro un solo widget con configurazione (SiriKit `IntentConfiguration` su iOS 16).
- Pet: il registro delle cure dovrebbe distinguere anche i cambi di nome e le schiuse con un'icona; oggi i nomi non compaiono.
- Pet: più cibi (con stagioni), un accessorio da sbloccare a ogni stadio, il pet nel widget con la sua nanna che si "spegne" (sfondo scuro anche nel piccolo).
- Pet: suono leggero (masticare, russare) quando arriveranno i suoni (sessione 8).
- Pet: promemoria gentile "vi aspetta" solo quando si apre l'app (le notifiche non sono possibili senza account a pagamento).
- Pet: tenere una piccola storia (dal giorno 1: stadi raggiunti, giorni di cura in due) nella scheda Noi.
- Pet: gioco a due (stessa partita su entrambi i telefoni) invece del gioco da soli.
- Pet: un widget "ultime cure" e una versione grande (large) con il registro.
- Distinguere nelle prove a due schede la fase "uovo" con il tempo finto, per verificare davvero il "torna a dormire dopo 3 giorni" anche nell'interfaccia.


## Idee dalla sessione 5
- Biglietto: più pagine per i disegni complessi, o un "timbro" (stickers) da trascinare; una gomma per cancellare un solo tratto.
- Biglietto: scadenza a scelta (15 min / 1 h / fino a stasera) e "lo vedo" (conferma di lettura gentile).
- Distanza: "ora siamo vicinissimi" come momento raro (coriandoli) quando scendete sotto 2 km; storia dei chilometri percorsi per vedersi.
- Distanza: posizione in `Posto` con nome ("a casa", "in ufficio") senza coordinate; mappa disegnata a adesivi con due puntini.
- Percorso B: tabella `widget_state` unica (umore, pensieri, domanda) servita dallo stesso feed, così anche umore e pet si aggiornano senza aprire l'app.
- Widget: AppIntent/widget interattivi quando il telefono sarà iOS 17+ (disegno veloce dal widget).
- Notifiche vere (APNs) se un giorno si paga l'account developer: il biglietto arriverebbe subito.
- Prova automatica del feed dal widget con un finto server locale (il Swift di rete non gira su Linux senza FoundationNetworking: serve un test a parte).
