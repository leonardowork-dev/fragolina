# IMPROVEMENTS.md — backlog (dopo il lancio)
Una riga per idea. Niente da fare in sessione 2 se non è qui sotto già fatto.

- ~~Prune dei `pings` più vecchi di 90 giorni~~ — fatto in sessione 8 (archivio dei conteggi, trigger).
- CAPTCHA/Turnstile sugli accessi anonimi (oggi: solo il limite di 30/ora per IP di Supabase).
- Notifiche push vere (richiedono account Apple a pagamento + APNs): oggi niente; alternativa gratuita: Percorso B del widget (fetch) per aggiornarlo senza aprire l'app.
- Realtime delle cancellazioni (`member-left`): oggi si scopre con la risincronizzazione (45 s o primo piano); si potrebbe usare un canale Broadcast.
- ~~`expo-network` per sapere subito quando torna la rete~~ — fatto in sessione 8 (`useNetworkRecovery`).
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
- ~~Pet: suono leggero (masticare, russare)~~ — fatto in sessione 8 (`chew`, `snore`; il russare suona quando metti a nanna).
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

## Idee dalla sessione 6 (mini giochi)
- **Più giochi:** Memory a coppie con le vostre foto, "Più o meno" (stima di numeri), "Cosa preferisci?" a due scelte secche, impiccato a due. La struttura (`reducer.ts` + `engine.ts` + SQL) li regge: un gioco nuovo = un ramo in `applyMove`/`_game_apply`, un `kind` nel check delle tabelle, una schermata.
- **Mazzi tuoi:** domande del quiz e parole scritte da voi due (si aggiungono in fondo senza riordinare), con le "domande che non avete mai fatto".
- **Quiz a tema stagionale** (Natale, estate) e una carta "domanda libera" in cui scrivi la domanda per lei.
- **Premio più ricco:** un adesivo da collezionare ogni 5 partite finite (senza contatori di serie perse: mai colpa).
- **Scadenza gentile delle partite ferme** (es. dopo 14 giorni "questa partita dorme: la chiudiamo?").
- **Rivedere un disegno dell'album a schermo intero** con la riproduzione tratto per tratto, e "Mandalo sul blocco" come biglietto con un tocco.
- **Disegni della Fragolina in più** (oggi 8) e un livello "difficile" per l'IA del Tris (minimax).
- **Notifiche push** (se mai fosse possibile a costo zero con sideload): "tocca a te a Tris".
- **Prova da solo con due telefoni finti:** una modalità di sviluppo con due identità sullo stesso telefono per provare tutto senza Nikole.

## Idee dalla sessione 7
- Foto: più foto insieme, ritaglio, filtri-adesivo, commenti brevi sotto una foto, "preferiti".
- Ricordi: esportare l'album in un PDF o in un video di fine anno (tutto sul telefono); promemoria gentile "tra una settimana è il vostro anniversario".
- Manca poco: ripetizione annuale (compleanni), più eventi nel widget medio (due righe), eventi "da lontano" con la distanza.
- Domanda del giorno: risposte con una foto o un disegno; categorie scelte da voi; "domanda della settimana" più profonda; archivio per categoria; esportare il libro delle risposte.
- Il nostro mese: confronto con il mese scorso, "momento dell'umore" con un nome, un adesivo-premio a fine mese.
- Notifiche (serve un account a pagamento: fuori budget): "Nikole ha risposto".
- Cancellazioni in tempo reale (oggi si vedono al prossimo sondaggio).
- Widget: "Un anno fa oggi" come widget grande (rimandato: Leonardo vuole solo i widget di tipo giorni/distanza/biglietto/conto alla rovescia).

## Idee dalla sessione 8
- **Suoni:** una famiglia di timbri per stagione (Natale), volume per categoria (azioni / feste), "suono di Nikole" diverso dal tuo per i momenti in arrivo; suoni dei widget non sono possibili (iOS).
- **Movimento:** transizione condivisa (shared element) dall'adesivo della Home alla pagina Manca poco/Ricordi; test su telefono con la registrazione dello schermo per misurare i fotogrammi.
- **Rete:** badge che si trasforma in una barra di avanzamento quando la coda si svuota ("3 → 2 → 1"); "ritenta ora" a mano toccando il badge.
- **Keepalive:** un secondo controllo che scrive un piccolo messaggio nel repository (un commit) ogni 50 giorni, così GitHub non sospende il workflow dopo 60 giorni di silenzio.
- **Server:** esportazione JSON di sicurezza (coppia, ricordi, domande) con un bottone in Noi, per l'eventualità di perdere il progetto gratuito.
- **Accessibilità:** test automatico su un vero albero di accessibilità (react-native-testing-library, `getByRole`) invece del controllo statico dei sorgenti; ordine di lettura di VoiceOver verificato con `accessibilityOrder` (iOS 17+).
- **Icona:** il tuo disegno al posto della fragola (`assets/user-art/app-icon.png`), e una variante scura (iOS 18) e una "tinted".
- **Dati brutti:** nomi con emoji disegnati con un font con emoji a colori nei display (oggi Bagel non le ha: iOS usa il carattere di sistema).

