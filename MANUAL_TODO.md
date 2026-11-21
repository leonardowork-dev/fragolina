# MANUAL_TODO.md — cosa devi fare tu (passo-passo, anche se non hai mai usato un terminale)

Tutto il resto lo fa Claude. Dopo ogni passo c'è scritto **cosa devi vedere**. Se qualcosa non torna, scrivi a Claude cosa vedi (anche solo "non c'è il pulsante").
Costo: **zero** (Supabase ha un piano gratuito che basta e avanza per due persone; non ti chiede la carta di credito).

---
## Novità: Claude applica da solo le migrazioni del database
Dalla fine della sessione 7 **non devi più incollare SQL su Supabase**: Claude lancia `npm run db:apply` (usa `SUPABASE_DB_URL` in `.env.local`, mai su git). I passaggi "incolla il file" delle sessioni 1-7 qui sotto restano solo come ripiego storico. Se Claude ti chiede la password del database: Supabase → Project Settings → Database → **Reset database password**, poi scrivila a Claude (una sola volta).

---
## PRIORITÀ 1 — Il database (serve per collegare i due telefoni)
Senza questo l'app funziona ma in "prova locale": non parla con il telefono di Nikole.

### 1A. Crea l'account e il progetto
1. Sul PC apri il browser e vai su **https://supabase.com**
2. In alto a destra clicca **Sign in** → **Continue with GitHub** (hai già un account GitHub) → **Authorize**.
3. Se ti chiede di creare un'organizzazione: lascia il nome che propone, scegli **Free** (gratis) → **Create organization**.
4. Clicca il pulsante verde **New project**.
5. Compila:
   - **Name**: `fragolina`
   - **Database password**: clicca **Generate a password**, poi **Copy**. Incollala in un file di testo tuo (Blocco note). Non ti serve nell'app, ma tienila.
   - **Region**: scegli **West EU (Ireland)** o **Central EU (Frankfurt)** (la più vicina all'Italia).
6. Clicca **Create new project**. Aspetta 1–2 minuti.
   **Devi vedere:** una pagina con il nome `fragolina` in alto e il menu a sinistra.

### 1B. Accendi l'accesso anonimo (è come i due telefoni entrano, senza email né password)
1. Nel menu a sinistra clicca l'icona **Authentication** (la persona con lo scudo).
2. Clicca **Sign In / Providers** (a volte si chiama **Providers**).
3. Scorri fino in fondo alla lista: trovi **Anonymous Sign-Ins**. Clicca per aprire.
4. Accendi l'interruttore **Allow anonymous sign-ins** (diventa verde) → **Save**.
   **Devi vedere:** l'interruttore verde e un avviso "Successfully updated settings".
5. (Consigliato) Nello stesso menu **Authentication** clicca **Rate Limits** e controlla che "Anonymous sign-ins" sia **30**. Va bene così.

### 1C. Crea le tabelle (incolla il file `supabase\all.sql`)
1. Apri **Esplora file** → vai nella cartella del progetto → apri la cartella **supabase**.
   (Se non sai dov'è: scrivi a Claude "dov'è all.sql?" e te lo apre lui.)
2. Clic destro su **all.sql** → **Apri con** → **Blocco note**.
3. Premi **Ctrl+A** (seleziona tutto) e poi **Ctrl+C** (copia).
4. Torna su Supabase. Nel menu a sinistra clicca **SQL Editor** (l'icona con `>_`).
5. Clicca **New query** (o **+**). Si apre una pagina bianca.
6. Clicca dentro la pagina e premi **Ctrl+V** (incolla). Devi vedere tante righe che iniziano con `--`.
7. Clicca il pulsante verde **Run** (in basso a destra) — se chiede conferma ("destructive operations") clicca **Run this query**.
   **Devi vedere:** in basso la scritta **Success. No rows returned**. Se vedi un errore rosso, copialo e scrivilo a Claude.
8. Controllo: nel menu a sinistra clicca **Table Editor**. Devi vedere le tabelle `couples`, `couple_members`, `mood_events`, `pings`, `daily_answers`.

### 1D. Copia i due valori (Project URL e chiave pubblica)
1. Nel menu a sinistra, in basso, clicca l'icona dell'ingranaggio **Project Settings**.
2. Clicca **Data API** (oppure **API**).
3. Trova **Project URL**: è del tipo `https://abcdefghij.supabase.co`. Clicca **Copy** accanto.
   Incollalo temporaneamente in Blocco note.
4. Trova la chiave **anon public** (oppure, nelle versioni nuove, **Publishable key** nella sezione **API Keys**). Clicca **Copy**. Incollala sotto, in Blocco note.
   ⚠️ **NON** copiare la chiave **service_role** / **secret**: quella è privata e non va mai nell'app.

### 1E. Dai i due valori all'app (un comando, nessuna domanda a Claude)
Scegli UNO dei due modi.

**Modo 1 — dal terminale di Windows (Ubuntu):**
1. Clicca **Start** (Windows) → scrivi **Ubuntu** → premi **Invio**. Si apre una finestra nera.
2. Scrivi questo (poi **Invio**):
   `cd ~/fragolina && npm run setup-env`
3. Ti chiede "1) Project URL": **incolla** (clic destro del mouse nella finestra) il valore copiato e premi **Invio**.
4. Ti chiede "2) Chiave": incolla la chiave pubblica e premi **Invio**.
   **Devi vedere:** `Fatto: …/.env.local`.
5. Per controllare che il database risponda, scrivi: `npm run backend:check` e **Invio**.
   **Devi vedere:** una tabella con tante righe **PASS** e alla fine `… prove passate` (es. `22/22`). Se vedi **FAIL**, scrivi a Claude la riga.

**Modo 2 — da dentro Claude:** nella chat scrivi `! cd ~/fragolina && npm run setup-env` e segui le due domande (stesse di sopra).

### 1F. Manda la nuova versione dell'app
Scrivi a Claude: **"manda una nuova build"** (oppure, se sei nel terminale: `cd ~/fragolina && npm run ship:release`).
Claude carica i valori su GitHub, costruisce l'app e ti mette il file nuovo sul Desktop in **Fragolina-build**. Può richiedere da 20 minuti a qualche ora quando i computer macOS di GitHub sono occupati (lo gestisce da solo).

---
## PRIORITÀ 2 — Installa la nuova versione sul tuo iPhone
Segui `scripts\SIDELOAD.md` parte **D** (rinnovo): cavo, Sideloadly, trascina `Fragolina-release.ipa`, **Start**. È un'installazione "sopra" la precedente: i tuoi dati restano. Lascia **spento** "Remove extensions" (altrimenti sparisce il widget).

## PRIORITÀ 3 — Collega te e Nikole
1. **Tu** apri Fragolina → **Noi** (in basso a destra) → nella scheda "Il vostro posto" scrivi il **tuo nome** → **Crea il nostro posto**.
2. Compare un codice grande di 6 lettere. Premi **Condividi** e mandalo a Nikole su WhatsApp (oppure **Copia**).
3. **Nikole** installa l'app (vedi priorità 4), apre Fragolina, scrive il **suo nome**, preme **Ho un codice**, scrive/incolla il codice → **Entra**.
   **Devi vedere (su tutti e due):** due fragole insieme, coriandoli e "Eccovi."
4. Da ora: **Penso a te** manda un avviso a lei in tempo reale (se ha l'app aperta), l'umore e la domanda del giorno si sincronizzano, la data "da quando state insieme" si sceglie toccando il riquadro giallo "Giorni insieme" (la può cambiare chiunque dei due).
5. Se il codice scade (dopo 24 ore): sul tuo telefono premi **Nuovo codice**.
6. (Consigliato, 1 minuto) Quando siete collegati, per impedire a chiunque di creare altre coppie: Supabase → **SQL Editor** → **New query** → incolla `insert into app_settings values ('closed','true');` → **Run**. (Per riaprire: `delete from app_settings where key='closed';`)

## PRIORITÀ 4 — Il telefono di Nikole
Serve il suo iPhone, un cavo, il PC con Sideloadly e **il suo Apple ID gratuito** (diverso dal tuo; ogni Apple ID gratuito può avere 3 app e scade ogni 7 giorni). Stessi passi di `scripts\SIDELOAD.md` (parti B–C), con il suo telefono. Il rinnovo ogni 7 giorni va fatto anche lì.
Se Nikole cambia telefono o reinstalla tutto: sul tuo telefono vai in **Noi → "Nikole ha un telefono nuovo?" → Libera il suo posto**, poi lei rientra con un codice nuovo.

## PRIORITÀ 5 — Cose da ricordare
- **Notifiche:** non ci sono (servono un account Apple a pagamento). Il widget si aggiorna quando apri l'app o quando iOS decide (di solito ogni tanto). "aggiornato 5 h fa" sul widget significa proprio questo.
- **Supabase in pausa:** i progetti gratuiti si mettono in pausa dopo 7 giorni senza nessuna attività. Se un giorno l'app dice "Senza rete" per molto tempo: Supabase → il progetto → **Restore project**. Usare l'app lo tiene vivo.
- Vuoi il vostro disegno al posto della fragola? Scrivi a Claude e allega i file (formati in `assets\user-art\README.md`).

---
## Sessione 3 — I nuovi widget (passo-passo)
Prima di tutto serve la build nuova: se Claude ti ha scritto che l'IPA è pronta, il file è sul **Desktop**, cartella **Fragolina-build**, nome **Fragolina-release.ipa**. (Il Desktop di Windows è quello dentro OneDrive: in Esplora file → **OneDrive → Desktop → Fragolina-build**.)

### S3-1. Installa il file nuovo sull'iPhone (sopra a quello vecchio: i dati restano)
1. Collega l'iPhone al PC con il cavo. Sbloccalo. Se chiede "Autorizzare questo computer?" tocca **Autorizza**.
2. Apri **Sideloadly** (menu Start → scrivi **Sideloadly** → Invio).
3. Nel riquadro in alto controlla che il tuo iPhone sia scelto (compare il suo nome).
4. Apri **Esplora file** → **OneDrive → Desktop → Fragolina-build** e **trascina** il file `Fragolina-release.ipa` dentro la finestra di Sideloadly (sopra la scritta "Drag IPA file here").
5. Scrivi il tuo **Apple ID di servizio** nella casella "Apple ID".
6. Clicca la freccia accanto a **Advanced Options** (opzioni avanzate). **Remove extensions (rimuovi estensioni) deve restare SPENTO**: se lo accendi i widget spariscono.
7. Clicca **Start**. Scrivi la password dell'Apple ID quando la chiede (e il codice a 6 cifre che arriva sul telefono, se lo chiede).
   **Devi vedere:** in basso la scritta **Done**. Sull'iPhone l'icona Fragolina è ancora al suo posto.
8. Se l'app non si apre ("sviluppatore non attendibile"): iPhone → **Impostazioni → Generali → VPN e gestione dispositivo** → tocca il tuo Apple ID → **Autorizza**.

### S3-2. Metti i widget sulla Home
1. Sulla schermata Home tieni premuto un punto **vuoto** finché le icone tremano.
2. In alto a sinistra tocca il **+**.
3. Nella lista scorri (o scrivi **Fragolina** nella ricerca) e tocca **Fragolina**.
4. Scorri **di lato**: trovi **tre** widget nuovi, ognuno in due grandezze (piccolo e medio):
   - **Il suo umore** (la fragola con la faccia di Nikole; il medio mostra anche il tuo umore),
   - **Penso a te** (il contatore dei pensieri; tocchi e le arriva un pensiero),
   - **Giorni insieme** (il numero grande e la prossima festa).
   C'è anche **Fragolina**, il widget di prima (umore + giorni + pensieri).
5. Scegli la grandezza scorrendo di lato, tocca **Aggiungi widget**, poi **Fine** (in alto a destra).
6. Ripeti dal punto 2 per ogni widget che vuoi.

### S3-3. Metti i widget sulla schermata di blocco
1. Blocca l'iPhone e svegliali, **senza sbloccare** (guarda lo schermo).
2. **Tieni premuto** sullo sfondo della schermata di blocco finché compare **Personalizza**. Toccalo (scegli **Schermata Blocco** se te lo chiede). Se ti chiede Face ID, sbloccalo.
3. Tocca il riquadro **sotto l'ora** (o la riga sopra l'ora per quello "inline").
4. Si apre l'elenco: scorri fino a **Fragolina** e tocca. Trovi due widget per il blocco: **Noi, sul blocco** (giorni insieme) e **Umore, sul blocco** (la faccina di Nikole). Tocca quello che vuoi: compare nel riquadro.
5. Tocca **Fine** in alto a destra, poi **Imposta come coppia di sfondi** se compare.

### S3-4. Cosa guardare sul telefono (checklist: scrivi a Claude cosa non va)
- [ ] I numeri grandi (giorni, pensieri) hanno il carattere **tondo e ciccione** di Fragolina (Bagel Fat One), non un carattere normale. Se sono normali: font non caricato (dimmelo).
- [ ] Nessun testo è tagliato male: guarda "Voglia di coccole", un nome lungo, un numero a 4-5 cifre (il widget "Giorni" se la data è molto vecchia).
- [ ] **Penso a te:** tocca il widget una volta. Si apre l'app, vedi **i cuori**, senti la **vibrazione** e compare "Inviato a Nikole". Controlla che a Nikole sia arrivato **UN solo** pensiero (non due). Poi tocca ancora: ne arriva un altro (uno per tocco).
- [ ] **Se non siete collegati**, toccare Penso a te ti porta alla scheda **Noi** e non manda nulla.
- [ ] Tocca il tuo riquadro nel widget medio "Il suo umore" (a destra): si apre la scelta del **tuo umore**. Scegline uno e controlla che il widget lo mostri dopo qualche secondo.
- [ ] Il widget **Giorni** dice il numero giusto. **Dopo mezzanotte** il numero deve salire di 1 anche se non apri l'app.
- [ ] Il giorno di un mesiversario (o dei 100/200/… giorni) il widget Giorni mostra i **coriandoli** e "Oggi: …!".
- [ ] "aggiornato X fa" compare sui widget se l'app resta chiusa per più di 3 ore; dopo 2 giorni la **fragola dorme**.
- [ ] Schermata di blocco: il numero dei giorni si legge bene (cerchio) e la faccina è riconoscibile (linee bianche).
- [ ] Margini: nessun widget ha il contenuto attaccato al bordo.
- [ ] I widget compaiono con nome e descrizione in italiano nell'elenco del **+**.

### S3-5. Il tuo disegno al posto della fragola (quando ce l'hai)
Metti il file **widget-mascot.png** (PNG trasparente 400×400, meno di 1 MB) nella cartella `assets\user-art` del progetto e scrivi a Claude "manda una nuova build". Dettagli in `assets\user-art\README.md`.


---
## Sessione 4 — Il pet condiviso (passo-passo, in ordine)

### S4-1. Accendi il pet sul database (una volta sola, 3 minuti)
Il pet ha bisogno di due tabelle nuove su Supabase. Senza questo passo l'app funziona lo stesso, ma la scheda **Pet** dice "Si sta ancora svegliando".
1. Sul PC apri il browser e vai su **https://supabase.com/dashboard** (accedi se serve). Clicca il tuo progetto (quello di Fragolina).
2. Nella colonna a sinistra clicca **SQL Editor** (l'icona con `>_`).
3. Clicca **New query** (in alto a sinistra, "Nuova query").
4. Apri il file **`supabase\sessione4-pet.sql`** del progetto (Esplora file → cartella `fragolina` → `supabase`; si apre con il Blocco note). Premi **Ctrl+A** (seleziona tutto) e **Ctrl+C** (copia).
   *Se il file non lo trovi da Windows:* `\\wsl$\Ubuntu\home\leonardo\fragolina\supabase\sessione4-pet.sql`.
5. Torna sul sito Supabase, clicca dentro la grande casella di testo e premi **Ctrl+V** (incolla).
6. Clicca il bottone verde **Run** (in basso a destra, oppure **Ctrl+Invio**).
   *Se compare un avviso giallo "potential issue / destructive operations":* è normale (la migrazione ripulisce vecchie regole con lo stesso nome). Clicca **Run this query**.
7. **Devi vedere** in basso la scritta **Success. No rows returned** (verde). Se vedi un errore rosso, copia il testo e mandalo a Claude.
   Questo file **non tocca** nulla di ciò che c'è già (umori, pensieri, coppia): è solo il pet. Si può rilanciare quante volte vuoi.
8. Controllo: apri il Terminale Ubuntu, scrivi `cd ~/fragolina && npm run backend:check` e premi **Invio**.
   **Devi vedere:** una tabella con tante righe **PASS** (anche quelle che iniziano con "pet") e alla fine `… prove passate` **senza** la riga `MANCA`. Se c'è ancora la riga **MANCA**, il passo 6 non è andato a buon fine.

### S4-2. Installa la nuova app sul tuo iPhone (Sideloadly)
1. Collega l'iPhone al PC col cavo, sbloccalo, se chiede "Registra questo computer" tocca **Registra**.
2. Apri **Sideloadly**.
3. Trascina dentro il file **`Fragolina-release.ipa`** (cartella **Desktop → Fragolina-build**; il Desktop è su OneDrive: `OneDrive\Desktop\Fragolina-build`).
4. Nella casella **Apple ID** scrivi lo **stesso Apple ID** dell'altra volta.
5. Clicca la freccia accanto a **Advanced Options**: **"Remove extensions" deve restare SPENTO** (se lo accendi i widget spariscono).
6. Clicca **Start**, scrivi la password (e il codice a 6 cifre se lo chiede).
   **Devi vedere:** in basso **Done.** Vuol dire fatto. È un'installazione "sopra": i tuoi dati restano.

### S4-3. Aggiungi il widget del Pet
1. Sulla Home tieni premuto **2 secondi** su uno spazio **vuoto** finché le icone tremano.
2. Tocca il **+** in alto a sinistra.
3. Scorri (o scrivi **Fragolina** nella ricerca) e tocca **Fragolina**.
4. Scorri **di lato** fino a **Il vostro pet**. Scegli **piccolo** o **medio**.
5. Tocca **Aggiungi widget**, poi **Fine** (in alto a destra).
   *Schermata di blocco:* tieni premuto sullo sfondo bloccato → **Personalizza** → riquadro sotto l'ora → **Fragolina → Il vostro pet** (rettangolare).

### S4-4. Cosa guardare sul telefono (checklist: scrivi a Claude cosa non va)
- [ ] **Pet → uovo:** toccalo. Vibra leggermente, ondeggia, compaiono crepe. Si deve vedere "Tu l'hai toccato" e "Nikole deve ancora toccarlo".
- [ ] **Schiusa a due:** quando **anche Nikole** tocca l'uovo, su **tutti e due** i telefoni l'uovo si schiude (coriandoli). A chi lo fa nascere si apre "Come la chiamate?" → scrivi un nome (max 16 lettere).
- [ ] **Coccole:** passa il dito **avanti e indietro** sul pet. Senti piccoli "tic", il pet ti segue; alla fine una vibrazione piena e compare "Hai fatto le coccole" nell'elenco.
- [ ] **Mangia:** tocca **Mangia**, trascina un frutto **sul pet** (oppure toccalo). Il pet mangia; se Nikole ha l'app aperta, vede "…ha dato una mora a …" subito.
- [ ] **Gioca:** prendi la fragola che rimbalza **3 volte**. **Nanna:** il riquadro si fa scuro e il pet dorme.
- [ ] I tre adesivi dei bisogni (frutto, cuore, luna) cambiano con le cure; col passare delle ore la faccia cambia (ha fame / vi aspetta / ha sonno).
- [ ] **Senza rete:** metti la modalità aereo, dai da mangiare: la cura si vede subito e sotto compare "1 cura in attesa di rete"; tolta la modalità aereo arriva da sola.
- [ ] **Widget Pet:** la faccia corrisponde a quella nell'app; toccandolo si apre la scheda **Pet**; dopo qualche ora (app chiusa) la faccia può cambiare da sola. Il **medio** mostra i tre bisogni e l'ultima cura ("Nikole ha dato una mora · 30 min fa").
- [ ] Nessun testo tagliato male nel widget (prova con un nome di 16 lettere); nessun bordo attaccato al margine.
- [ ] I widget di prima (umore, Penso a te, Giorni, blocco) funzionano ancora.

## Sessione 5 — Biglietti sul blocco e distanza (passo-passo, in ordine)

### S5-1. Accendi biglietti e distanza sul database (una volta sola, 3 minuti)
Servono tre tabelle nuove su Supabase. Senza questo passo l'app funziona lo stesso, ma la scheda **Disegna** dice "Manca un passo" e il widget Biglietto resta vuoto.
1. Sul PC apri il browser e vai su **https://supabase.com/dashboard** (accedi se serve). Clicca il tuo progetto (quello di Fragolina).
2. Nella colonna a sinistra clicca **SQL Editor** (l'icona con `>_`).
3. Clicca **New query** (in alto a sinistra).
4. Apri il file **`supabase\sessione5-note.sql`** del progetto (Esplora file → cartella `fragolina` → `supabase`; si apre con il Blocco note). Premi **Ctrl+A** (seleziona tutto) e **Ctrl+C** (copia).
   *Se il file non lo trovi da Windows:* `\\wsl$\Ubuntu\home\leonardo\fragolina\supabase\sessione5-note.sql`.
5. Torna sul sito Supabase, clicca dentro la grande casella di testo e premi **Ctrl+V** (incolla).
6. Clicca il bottone verde **Run** (in basso a destra, oppure **Ctrl+Invio**).
   *Se compare un avviso giallo "potential issue / destructive operations":* è normale. Clicca **Run this query**.
7. **Devi vedere** in basso **Success. No rows returned** (verde). Se vedi un errore rosso, copia il testo e mandalo a Claude. Il file **non tocca** nulla di ciò che c'è già (umori, pensieri, pet). Si può rilanciare quante volte vuoi.
8. Controllo: apri il Terminale Ubuntu, scrivi `cd ~/fragolina && npm run backend:check` e premi **Invio**.
   **Devi vedere:** tante righe **PASS** (anche quelle che iniziano con "biglietto", "widget" e "distanza") e alla fine `… prove passate` **senza** la riga `MANCA`. Se c'è ancora **MANCA**, il passo 6 non è andato a buon fine. Se vedi qualche **FAIL** con `ConnectTimeoutError`, è la rete: rilancia il comando.

### S5-2. Installa la nuova app sul tuo iPhone (Sideloadly)
1. Collega l'iPhone al PC col cavo, sbloccalo (se chiede "Registra questo computer" tocca **Registra**).
2. Apri **Sideloadly** e trascina dentro **`Fragolina-release.ipa`** (cartella **Desktop → Fragolina-build**; il Desktop è su OneDrive: `OneDrive\Desktop\Fragolina-build`).
3. Nella casella **Apple ID** scrivi lo **stesso Apple ID** dell'altra volta.
4. Clicca la freccia accanto a **Advanced Options**: **"Remove extensions" deve restare SPENTO**.
5. Clicca **Start**, scrivi la password (e il codice a 6 cifre se lo chiede). **Devi vedere** **Done.** È un'installazione "sopra": i tuoi dati restano.
6. **Se i widget nuovi non compaiono nella galleria dopo l'installazione:** riavvia l'iPhone (tieni premuto il tasto laterale → scorri per spegnere → riaccendi). iOS a volte tiene in memoria l'elenco vecchio.

### S5-3. Il permesso della posizione (solo se vuoi la distanza)
1. Apri **Fragolina → scheda Noi**. Scorri fino al riquadro **Distanza**.
2. Accendi **Condividi la distanza**. Compare una schermata nostra che spiega perché: tocca **Va bene**.
3. iOS chiede il permesso: tocca **Consenti mentre usi l'app**.
4. *Facoltativo:* accendi **Aggiorna anche ad app chiusa**: iOS chiede «Sempre» (o ti manda in Impostazioni → Fragolina → Posizione → **Sempre**). Serve solo se vuoi la distanza fresca senza aprire l'app. Si può spegnere quando vuoi.
5. La distanza compare solo quando **tutti e due** l'avete accesa. Finché Nikole non c'è vedrai "Non ancora condivisa": è normale.

### S5-4. Aggiungi i widget nuovi
**Home:** tieni premuto **2 secondi** su uno spazio vuoto finché le icone tremano → **+** in alto a sinistra → scrivi **Fragolina** nella ricerca e toccala → scorri **di lato**: **Biglietto**, **Distanza tra noi**, e anche **Il vostro pet** (se prima non c'era, ora deve esserci) → scegli piccolo o medio → **Aggiungi widget** → **Fine**.
**Schermata di blocco:** tieni premuto sullo sfondo bloccato → **Personalizza** → il riquadro sotto l'ora → **Fragolina**: **Biglietto** (rettangolare), **Distanza** (tondo o riga).

### S5-5. Provalo da solo (Nikole non c'è ancora): il Percorso B
Scopo: controllare che il widget riceva il biglietto **da solo**, senza che l'app sia aperta.
1. Nell'app: scheda **Disegna** → disegna qualcosa (o scegli **Scritta** e scrivi due parole) → **Manda**. Compare "Sul blocco adesso" con "sparisce tra 60 min".
2. Il widget **Biglietto** sulla Home (e quello sul blocco) lo mostra entro pochi secondi, con "da te · adesso".
3. **Togli l'app dalle app recenti** (scorri verso l'alto dal bordo e spingi l'app Fragolina fuori dallo schermo). **Blocca il telefono.**
4. Controlla il widget sul **blocco**: deve mostrare il biglietto (disegno in bianco e nero). Se lo vedi, la strada del widget verso il server funziona.
5. Per provare che arrivi anche quando è **cambiato sul server**: rientra nell'app, tocca **Pulisci**, togli di nuovo l'app dalle recenti e blocca. Dopo un po' (iOS ricarica ogni 15–30 minuti, non subito) il widget deve tornare a "Niente biglietti".
6. Dopo **un'ora** dall'invio il widget si svuota da solo (anche col telefono bloccato e senza rete).
Se non va: scrivi a Claude **cosa vedi** (testo esatto) e **quanto tempo è passato**.

### S5-6. Cosa guardare sul telefono (checklist: scrivi a Claude cosa non va)
- [ ] **Galleria widget:** compaiono **Il vostro pet**, **Biglietto**, **Distanza tra noi** (oltre a umore, Penso a te, Giorni, blocco). Se "Il vostro pet" manca ancora: riavvia l'iPhone e riguarda; se manca ancora scrivi a Claude.
- [ ] **Disegna:** la tela è quadrata; 5 colori, "Fine"/"Spesso", "Annulla", "Pulisci tela"; il disegno si fa col dito senza far scorrere la pagina. L'anteprima in basso ("Così lo vede il widget") somiglia al widget vero.
- [ ] **Scritta:** scrivi 80 caratteri (il contatore si ferma a 80), scegli lo sfondo; la scritta sul widget è leggibile.
- [ ] **Manda:** una vibrazione piena, compare "Mandato" e il biglietto in cima con "sparisce tra N min" e **Pulisci**.
- [ ] **Offline:** modalità aereo → Manda → compare "in coda"; togli la modalità aereo: parte da solo.
- [ ] **Widget Biglietto** piccolo, medio e sul blocco: disegno nitido, "da te · X min fa", nessun testo tagliato male; toccandolo si apre **Disegna**.
- [ ] **Widget vuoto:** "Niente biglietti — Toccami per disegnare."
- [ ] **Distanza** (quando ci sarà Nikole): "a 342 km" / "vicinissimi" / "aggiornata 3 h fa"; se uno spegne: "Distanza nascosta".
- [ ] I widget di prima (umore, Penso a te, Giorni, Pet, blocco) funzionano ancora.
- [ ] Il widget **Giorni insieme** (già esistente) sta bene accanto ai nuovi (stessa grafica, stessi margini).

## Sessione 6 — Mini giochi a due (passo-passo, in ordine)

### S6-1. Accendi i giochi sul database (una volta sola, 3 minuti)
Servono alcune tabelle nuove su Supabase (partite, mosse, segreti, punteggi). Senza questo passo l'app funziona lo stesso, ma la scheda **Gioca** dice "Manca un passo" (la **Prova con la Fragolina** funziona comunque: è tutta sul telefono).
1. Sul PC apri il browser e vai su **https://supabase.com/dashboard** (accedi se serve). Clicca il tuo progetto (quello di Fragolina).
2. Nella colonna a sinistra clicca **SQL Editor** (l'icona con `>_`).
3. Clicca **New query** (in alto a sinistra).
4. Apri il file **`supabase\sessione6-giochi.sql`** del progetto (Esplora file → cartella `fragolina` → `supabase`; si apre con il Blocco note). Premi **Ctrl+A** (seleziona tutto) e **Ctrl+C** (copia).
   *Se il file non lo trovi da Windows:* `\\wsl$\Ubuntu\home\leonardo\fragolina\supabase\sessione6-giochi.sql`.
5. Torna sul sito Supabase, clicca dentro la grande casella di testo e premi **Ctrl+V** (incolla).
6. Clicca il bottone verde **Run** (in basso a destra, oppure **Ctrl+Invio**).
   *Se compare un avviso giallo "potential issue / destructive operations":* è normale. Clicca **Run this query**.
7. **Devi vedere** in basso **Success. No rows returned** (verde). Se vedi un errore rosso, copia il testo e mandalo a Claude. Il file **non tocca** nulla di ciò che c'è già (umori, pensieri, pet, biglietti). Si può rilanciare quante volte vuoi. (Le migrazioni delle sessioni 4 e 5 devono essere già state incollate.)
8. Controllo: apri il Terminale Ubuntu (Start → scrivi **Ubuntu** → Invio), scrivi `cd ~/fragolina && npm run backend:check` e premi **Invio**.
   **Devi vedere:** tante righe **PASS** (anche quelle che iniziano con "tris", "quiz", "disegna", "giochi") e alla fine `… prove passate` **senza** la riga `MANCA`. Se c'è ancora **MANCA** ("Giochi: la migrazione della sessione 6 NON è ancora stata eseguita"), il passo 6 non è andato a buon fine. Se vedi qualche **FAIL** con `ConnectTimeoutError` è la rete: rilancia.
   *(Il controllo crea due "telefoni finti" sul tuo progetto, gioca una partita per ogni gioco e poi cancella tutto: non resta niente.)*

### S6-2. Installa la nuova app sul tuo iPhone (Sideloadly)
1. Collega l'iPhone al PC col cavo, sbloccalo (se chiede "Registra questo computer" tocca **Registra**).
2. Apri **Sideloadly** e trascina dentro **`Fragolina-release.ipa`** (cartella **Desktop → Fragolina-build**; il Desktop è su OneDrive: `OneDrive\Desktop\Fragolina-build`).
3. Nella casella **Apple ID** scrivi lo **stesso Apple ID** dell'altra volta.
4. **Advanced Options → "Remove extensions" deve restare SPENTO.**
5. Clicca **Start**, scrivi la password (e il codice a 6 cifre se lo chiede). **Devi vedere** **Done.** È un'installazione "sopra": i tuoi dati restano. (Scade dopo 7 giorni, come sempre.)

### S6-3. Provali da solo, uno per uno (Nikole non c'è ancora)
Apri l'app → scheda **Gioca** (l'icona del dado). Se non siete collegati in due vedi **Si gioca in due** e, sotto, il riquadro giallo **PROVA · Prova con la Fragolina**: toccalo. (Se siete già in due, la prova è il link piccolo rosso in fondo: **Prova da solo con la Fragolina**.) In alto compare sempre l'avviso **PROVA: gioca la Fragolina, non Nikole. Niente va sul server.** Niente di ciò che fai in prova arriva a Nikole, non occupa il suo posto e non tocca il pet.
- **Tris della fragola:** tocca il riquadro grande → **Inizia**. Tu sei la fragola o il fiore (c'è scritto). Tocca una casella: la pedina "si attacca" con una vibrazione leggera. La Fragolina risponde dopo un secondo e **a volte sbaglia apposta**. Se vinci: linea gialla e coriandoli. **Rivincita**: chi inizia si alterna.
- **Quanto mi conosci?:** **Inizia** → 5 domande. Quando tocca a te rispondere "su di te" scegli un'opzione; quando devi indovinare scegli come pensi abbia risposto la Fragolina (che risponde a caso). Le carte in alto si girano quando entrambi hanno risposto. Alla fine: "4/5, vi conoscete!".
- **Disegna e indovina:** **Inizia**. **La prima volta disegna la Fragolina** (un disegno preregistrato: sole, luna, cuore, casa, fiore, albero, stella, pesce): lo vedi ridisegnarsi tratto per tratto; scrivi cosa pensi che sia (3 tentativi; maiuscole, accenti e plurali semplici vanno bene). **La volta dopo tocca a te:** ti dà una parola, tocchi **Via! 60 secondi**, disegni col dito, **Manda il disegno**; la Fragolina prova a indovinare (a volte sbaglia). I disegni finiti restano nell'**Album**.
- **Lascia la partita** (in fondo a ogni gioco) chiude la partita; **Ricomincia da zero** (in fondo alla schermata Gioca, in prova) azzera la prova.

### S6-4. Quando arriva Nikole (sessione 9) — cosa cambia
Appena siete in due, in **Gioca** compaiono le partite vere: la partita in cui **tocca a te** è il riquadro grande; sotto gli altri due giochi e lo sticker con i punteggi ("Leonardo 7 – Nikole 9"). Se Nikole muove mentre sei nell'app arriva un avviso in alto; in Home compare "Tocca a te a Tris della fragola" solo se c'è un turno in sospeso. Link: `fragolina://play`, `fragolina://play/tris`, `…/quiz`, `…/draw`.

### S6-5. Cosa guardare sul telefono (checklist: scrivi a Claude cosa non va)
- [ ] **Gioca:** un riquadro grande in alto, due riquadri diversi sotto, uno sticker con i punteggi. Il testo non è tagliato.
- [ ] **Tris:** la pedina si "attacca" con una piccola vibrazione; la linea vincente si vede; i coriandoli compaiono **solo** quando vinci.
- [ ] **Quiz:** i bottoni delle risposte sono comodi (si toccano bene col pollice); le carte si girano.
- [ ] **Disegna e indovina:** il disegno col dito non fa scorrere la pagina; il conto alla rovescia 60 s parte con **Via!**; il disegno della Fragolina si ridisegna tratto per tratto; la tastiera non copre il campo della risposta.
- [ ] **Meno movimento** (Impostazioni → Accessibilità → Movimento ridotto): niente rimbalzi, il disegno compare intero.
- [ ] **Senza rete** (modalità aereo): in prova funziona lo stesso (è tutta locale).
- [ ] Le vibrazioni: una per azione (casella, risposta, invio).
- [ ] Biglietto, distanza, pet e widget di prima funzionano ancora.

## Sessione 7 — Manca poco, domanda del giorno vera, Ricordi (passo-passo, in ordine)

### S7-1. Accendi le novità sul database — **fatto da Claude con `db:apply`** (ripiego manuale sotto)
Servono tabelle nuove su Supabase (eventi, domanda del giorno, ricordi) **e un contenitore privato per le foto**. Il file fa tutto da solo, compreso il contenitore: **non devi cliccare nient'altro nel pannello**. Senza questo passo l'app funziona lo stesso, ma Noi dice **"Manca un passo"** e le nuove schede (Manca poco, domanda, Ricordi, Il nostro mese) restano vuote.
1. Sul PC apri **https://supabase.com/dashboard** (accedi se serve) e clicca il tuo progetto di Fragolina.
2. Colonna a sinistra → **SQL Editor** (icona `>_`) → **New query**.
3. Apri il file **`supabase\sessione7-extra.sql`** (Esplora file → cartella `fragolina` → `supabase`; si apre con il Blocco note; da Windows anche `\\wsl$\Ubuntu\home\leonardo\fragolina\supabase\sessione7-extra.sql`). **Ctrl+A**, **Ctrl+C**.
4. Torna su Supabase, clicca dentro la casella grande, **Ctrl+V**.
5. Bottone verde **Run** (o Ctrl+Invio). Se compare un avviso giallo ("destructive operations"): è normale, **Run this query**.
6. **Devi vedere "Success. No rows returned"**. Se vedi un errore rosso, copia il testo e mandalo a Claude. Il file **non cancella nulla**: le risposte alla domanda del giorno già date vengono copiate nel nuovo formato (restano segrete finché l'altro non risponde). Si può rilanciare quante volte vuoi. (Le migrazioni delle sessioni 4, 5 e 6 devono essere già state incollate.)
7. Controllo: Terminale Ubuntu → `cd ~/fragolina && npm run backend:check` → Invio. **Devi vedere** tante **PASS** (anche "eventi", "domanda", "segreto", "Storage", "ricordi") e alla fine `… prove passate` **senza** la riga `MANCA`.
   *(Il controllo carica una piccola immagine di prova nel contenitore vero e la cancella.)*
   *Se **un'unica riga di Storage** fallisce:* nel pannello Supabase → **Storage** controlla che esista il contenitore **memories** (deve essere **Private**). Se non c'è, **New bucket** → nome `memories` → lascia spento "Public bucket" → **Save**, poi rilancia il file SQL del passo 3 (aggiunge le regole) e il controllo.

### S7-2. Installa la nuova app sul tuo iPhone (Sideloadly)
1. Collega l'iPhone al PC, sbloccalo.
2. **Sideloadly** → trascina **`Fragolina-release.ipa`** (Desktop → **Fragolina-build**, cioè `OneDrive\Desktop\Fragolina-build`).
3. **Apple ID**: lo stesso dell'altra volta. **Advanced Options → "Remove extensions" resta SPENTO.**
4. **Start**, password (e codice a 6 cifre se lo chiede). **Devi vedere Done.** È un'installazione "sopra": i dati restano.
5. **Permesso Foto:** la prima volta che tocchi **Aggiungi foto** iOS mostra il selettore di sistema (non chiede nulla per leggere tutto il rullino: legge solo la foto che scegli). Il testo del permesso, se lo chiede, è in italiano.

### S7-3. Il nuovo widget "Manca poco"
Home dell'iPhone → tieni premuto su uno spazio vuoto → **+** → cerca **Fragolina** → **Manca poco** → scegli piccolo o medio → **Aggiungi widget**. Schermata di blocco: tieni premuto sul blocco → **Personalizza** → **Aggiungi widget** → **Manca poco** (cerchio o riga). Se non lo vedi in galleria: riavvia l'iPhone (iOS tiene in cache l'elenco) e riprova.
Il widget mostra l'evento "in evidenza" (o il più vicino): il numero dei giorni scatta da solo a mezzanotte, nell'ultimo giorno passa alle **ore** e il giorno dell'evento c'è la festa. Cambia anche se l'evento lo crea Nikole (lo scarica da solo).

### S7-4. Come provare tutto DA SOLO (Nikole non c'è ancora)
- **Manca poco:** scheda **Noi → Insieme → Manca poco** → **Nuovo evento**: titolo ("Ci vediamo"), data, ora (facoltativa), un simbolo, interruttore **In evidenza**. In Home compare l'adesivo celeste "tra 7 giorni: Ci vediamo". Metti un evento **per oggi** per vedere la festa (coriandoli) e controlla il widget.
- **Domanda del giorno:** in Home tocca la carta **Domanda del giorno** → scrivi una risposta (max 280 caratteri) → **Rispondi**. Da solo vedi "Hai risposto" (la carta con le due risposte si gira quando risponde anche l'altra persona). **"Domani"**: a giorni alterni tocca a te scrivere la domanda del giorno dopo.
- **Ricordi:** **Noi → Insieme → Ricordi** → **Aggiungi foto** → scegli → didascalia e giorno → **Metti nell'album**. Una foto con la data di un anno fa compare in Home come **"Un anno fa oggi"**. Tocca la foto per vederla grande; **Cancella foto** (con conferma) la toglie anche dal server. Dalla scheda **Disegna** (biglietto sul blocco) e dall'**Album** dei disegni di Gioca c'è **Tieni nei ricordi**.
- **Il nostro mese:** **Noi → Insieme → Il nostro mese** (o l'adesivo verde in Home): i tuoi umori, i pensieri, le partite, i giorni con due risposte.
- **Senza rete:** modalità aereo → crea un evento o aggiungi una foto: si vede subito e dice **in coda**; parte da sola quando torna la rete.

### S7-5. Cosa guardare sul telefono (checklist: scrivi a Claude cosa non va)
- [ ] **Home:** sotto "Il tuo umore" ci sono la domanda, (se c'è un evento) **Manca poco**, (solo se c'è qualcosa) **Un anno fa oggi**, poi i due adesivi **Ricordi** e **Il nostro mese**. Niente testo tagliato.
- [ ] **Manca poco:** l'evento grande in giallo, gli altri sotto con colori diversi; il giorno dell'evento coriandoli **una volta**.
- [ ] **Widget Manca poco** (piccolo, medio, cerchio e riga sul blocco): numero grande, titolo, data; il numero cambia a mezzanotte.
- [ ] **Domanda:** la tastiera non copre la casella; il contatore va da 0 a 280.
- [ ] **Foto:** il selettore di iOS si apre; la foto compare nell'album e non pesa più di ~500 KB; la scheda si scorre con il dito dentro la foto grande.
- [ ] **Meno movimento:** la carta delle risposte non si gira ma compare in dissolvenza.
- [ ] Biglietto, distanza, pet, giochi e widget di prima funzionano ancora.

### S7-6. Quando arriva Nikole (sessione 9)
Ognuno vede gli eventi dell'altra persona e le foto in tempo reale. La domanda del giorno è **la stessa per entrambi** (giorno = ora di Roma per tutti e due); la risposta dell'altra resta **segreta finché non rispondi anche tu**; "Domani" si alterna (un giorno scrive Leonardo, il giorno dopo Nikole).


## Sessione 8 — Rifinitura: suoni, transizioni, casi limite, icona (passo-passo)

### S8-0. Cosa è già fatto DA CLAUDE (non devi toccare niente)
- **Database:** la pulizia dei "penso a te" più vecchi di 90 giorni è già applicata (`npm run db:apply`, file `supabase/sessione8-rifinitura.sql`). Non perde nulla: totali e "Il nostro mese" contano anche i vecchi.
- **Controlli:** `backend:check` (server vero), `backend:sqltest`, `npm test`, `tsc`, `eslint`, prove nel browser (`npm run e2e`): fatti prima della build.
- **Keepalive:** su GitHub gira da solo ogni 3 giorni un piccolo controllo che tiene sveglio il progetto Supabase (così non va in pausa dopo 7 giorni). Se un giorno fallisce, GitHub ti manda una mail "Keepalive Supabase failed": significa che il progetto dorme → vedi S8-5.
- **Build:** `npm run ship:release` → `Fragolina-release.ipa` in `OneDrive\Desktop\Fragolina-build`. Claude apre la cartella e Sideloadly.

### S8-1. Installa la nuova app (Sideloadly) — l'unica cosa che resta a te
1. Collega l'iPhone al PC con il cavo e **sbloccalo**.
2. In **Sideloadly** trascina **`Fragolina-release.ipa`** dalla cartella **Fragolina-build** che si è aperta (se non è già caricato).
3. **Apple ID**: lo stesso di sempre. **"Remove extensions" resta SPENTO** (altrimenti spariscono i widget).
4. Premi **Start**, scrivi la password dell'Apple ID se la chiede, aspetta **Done**.
5. È un'installazione "sopra": **coppia, pet, foto e coda restano**. (Vedi S8-6 per i dettagli e per cosa fare se l'app chiede di ricollegarsi.)

### S8-2. Cosa provare (spunta man mano; se qualcosa non va, scrivi a Claude cosa)
**Suoni** (originali, bassi, un suono per azione)
- [ ] **Interruttore silenzioso (quello sul fianco dell'iPhone) SPENTO** (niente arancione visibile): tocca **Penso a te** → senti un "pop". Scegli un umore → "plink". Dai da mangiare al pet → "mastica"; carezza → "mmh"; manda un biglietto → fruscio di carta; mossa a Tris → "tok"; foto nell'album → "scatto".
- [ ] **Interruttore silenzioso ACCESO** (si vede l'arancione): **nessun suono**, ma le vibrazioni restano.
- [ ] **Noi → Impostazioni → Suoni**: spento = silenzio assoluto, acceso = tornano. Resta dopo aver chiuso e riaperto l'app. **"Meno movimento" NON spegne i suoni** (si spengono solo con "Suoni").
- [ ] Con la **musica** in sottofondo (Spotify/Musica): i suoni si sentono sopra, **la musica non si interrompe**.
- [ ] Carezze o mosse velocissime: non fa "mitragliatrice" (al massimo un suono ogni 0,12 s).
- [ ] Nel laboratorio (5 tocchi sul titolo Fragolina in Home → sezione **Suoni**) c'è un bottone per ogni suono: serve a sentirli tutti.

**Transizioni e avvio**
- [ ] Apertura app: schermata rossa col marchio → Home **senza salti** (nessun lampo bianco, nessun cambio di font). Dopo il caricamento ci vuole meno di mezzo secondo.
- [ ] **Home → Manca poco / Ricordi / Il nostro mese / Domanda**: la pagina entra da destra; **trascina dal bordo sinistro** per tornare indietro; nessun lampo bianco.
- [ ] Le 5 schede (Home, Pet, Disegna, Gioca, Noi) cambiano **subito**, senza animazioni (voluto).
- [ ] Il numero dei giorni insieme "scorre" solo quando cambia (un giorno nuovo), **non a ogni apertura**. Coriandoli di un evento: **una volta sola**, anche se riapri l'app più volte.
- [ ] Pet: la fragolina si muove (respira) solo quando sei nella scheda Pet.

**Casi limite**
- [ ] **Modalità aereo**: tocca "Penso a te" due volte → compare **un solo** adesivo in alto sopra la barra: "Senza rete · 2 in attesa". Togli la modalità aereo → **dopo pochi secondi sparisce da solo** e Nikole riceve i pensieri.
- [ ] **Testo grande**: Impostazioni iPhone → Schermo e luminosità → Dimensione testo → trascina al massimo (e anche "Testo più grande" in Accessibilità). Guarda Home, Pet, Noi, Manca poco, Ricordi: niente testo tagliato nei punti importanti (i nomi molto lunghi si rimpiccioliscono).
- [ ] **VoiceOver** (facoltativo): Impostazioni → Accessibilità → VoiceOver. Ogni bottone ha un nome parlato.
- [ ] **Disegna e indovina**: inizia a disegnare, esci dalla scheda (o chiudi l'app) e rientra entro 60 s → **il disegno è ancora lì** e il tempo è quello che resta.
- [ ] **Se il server è in pausa**: compare "Il server dorme" (vedi S8-5).

**Versione e icona**
- [ ] **Noi** (in fondo): "Fragolina · Versione 1.0.0 (build N, abc1234)". **N cresce a ogni installazione** (serve per capire quale IPA hai).
- [ ] **Icona nuova**: fragola con bordo bianco su fondo rosso (lo stesso rosso dell'avvio). Se vedi ancora la vecchia (fondo rosa): **riavvia l'iPhone** (iOS tiene l'icona in cache).
- [ ] Il nome sotto l'icona è **Fragolina**.

### S8-3. Come mettere il TUO disegno come icona
1. Sul PC apri **Esplora file** e scrivi nella barra in alto: `\\wsl$\Ubuntu\home\leonardo\fragolina\assets\user-art\` → Invio.
2. Incolla lì un file chiamato esattamente **`app-icon.png`**: **1024×1024 pixel, quadrato, senza trasparenza**, angoli NON arrotondati (li fa iOS).
3. Scrivi a Claude: **"rifai la build"**. Fa tutto lui (e riapre Sideloadly).
4. Dopo l'installazione, se vedi la vecchia icona: **riavvia l'iPhone**.
(Se il file non c'è, l'app usa la fragola disegnata da Claude: `scripts/make-icon.mjs`, `npm run icons`.)

### S8-4. Per Claude: comandi nuovi
`npm run sounds:gen` (rigenera `assets/sounds/*.wav`), `npm run e2e:s8` (prova della sessione 8; serve `npm run web` con `.env.local` spostato e `CHROME_LIBS`), `node scripts/make-icon.mjs --variants` (anteprime icona in `docs/shots/session8/icon/`), `npm run icons` (rigenera icona e marchio dello splash).

### S8-5. Se compare "Il server dorme" (progetto Supabase in pausa)
Il piano gratuito mette il progetto in pausa dopo 7 giorni **senza attività**; il keepalive di GitHub lo evita, ma se GitHub salta un giro succede. Cosa vedi: l'adesivo "Il server dorme" e, in Noi, una spiegazione. **Quello che fai non si perde**: resta sul telefono e parte da solo appena si risveglia.
1. Sul PC apri **https://supabase.com/dashboard** → clicca il progetto di Fragolina.
2. Se vedi **"Project paused"** → bottone **Restore project** → aspetta 1-2 minuti.
3. Sul telefono tocca "Penso a te" per provare: l'adesivo sparisce.
Per controllare che il keepalive funzioni: GitHub → repository `fragolina` → **Actions** → **Keepalive Supabase** → ultimo giro verde (si può lanciare a mano con **Run workflow**).

### S8-6. Reinstallare ogni 7 giorni (con l'Apple ID gratuito): cosa resta e cosa no
- L'app firmata con un Apple ID gratuito **smette di aprirsi dopo 7 giorni** ("App non disponibile"). Si rimette a posto reinstallando con Sideloadly **lo stesso IPA con lo stesso Apple ID**: è un aggiornamento "sopra" (stesso identificativo `app.fragolina.couple`), **non cancella i dati**.
- **Resta:** coppia, nomi, data, pet, ricordi (le foto sono sul server), la **coda offline** (le cose fatte senza rete partono da sole), il **token dei widget** (sta nei dati condivisi con i widget), le impostazioni, la sessione (sta nel Portachiavi).
- **Ripartenza pulita:** se riapri l'app scaduta dopo il rinnovo, al primo avvio sincronizza, svuota la coda e i widget si riaggiornano. Una cosa in coda che nel frattempo non ha più senso (es. una risposta di un giorno troppo vecchio) viene scartata con un avviso gentile.
- **NON resta (e come si rimedia):** se **cambi Apple ID** o **disinstalli l'app a mano**, iOS può perdere la sessione nel Portachiavi: l'app lo dice con un adesivo giallo in Noi ("Questo telefono non è più nel posto") e basta **ricollegarsi con un codice** (Noi → crea un nuovo posto; l'altra persona entra col codice). Non si perde nulla sul server.
- **Routine:** una volta a settimana (es. la domenica): collega l'iPhone → Sideloadly → stesso IPA → Start. Claude può rifare la build quando serve (scrivi "rifai la build").

### S8-7. Cosa NON posso fare da solo (e perché)
- **Sentire i suoni e vedere i movimenti sul telefono:** non ho un iPhone né un Mac. Ho provato file, tempi, regole e schermate nel browser; l'orecchio e il dito sono tuoi (checklist S8-2).
- **Premere Start in Sideloadly:** richiede l'iPhone collegato, sbloccato e la tua password Apple (non la tengo io, giustamente).


## Sessione 9 — Scadenza visibile e rinnovo (passo-passo)

### S9-0. Già fatto da Claude
- Migrazione `sessione9-scadenza.sql` applicata (`db:apply`), `backend:check` 144/144, `backend:sqltest` 330/330, `npm test`, `tsc`, `eslint`, parità Swift.
- Guide pronte per la **sessione 11** (non fare nulla ora sul telefono di Nikole): `NIKOLE.md`, `docs/nikole.html`, `RINNOVO.md`, `docs/rinnovo-fragolina.ics`, `docs/RENEWAL.md`.

### S9-1. Installa la nuova app sul tuo iPhone (Sideloadly)
Come sempre: cavo, `Fragolina-release.ipa` (Desktop → Fragolina-build), stesso Apple ID, **"Remove extensions" spento**, **spunta "Automatic Refresh via Sideloadly Daemon"** (e in iTunes: "Sincronizza con questo iPhone via Wi-Fi"). In **Noi** deve comparire "Rinnovo: Fragolina scade tra 7 giorni (…)".

### S9-2. Cosa guardare
- [ ] Noi → scheda **Rinnovo** con la data giusta (7 giorni dopo l'installazione).
- [ ] Home: l'adesivo giallo "Rinnova Fragolina…" compare solo quando mancano ≤ 2 giorni; toccandolo si apre la guida.
- [ ] Widget (Giorni, Umore, Penso a te, Pet, Biglietto, Distanza, Manca poco): nell'ultimo giorno un piccolo "rinnovami" in alto a sinistra. **Il layout non è visto su schermo**: se copre qualcosa, scrivi a Claude cosa e dove.
- [ ] Dopo un rinnovo il "rinnovami" sparisce dal widget anche senza aprire l'app.
- Da **scaduta** l'app non si apre e il widget non serve: va rinnovata (i dati restano).

### S9-3. Quando Nikole è dentro (sessione 11)
Di' a Claude: **"Nikole è entrata, chiudi la coppia"** → `npm run couple:close`. Poi `npm run couple:status` per vedere membri, scadenze e ultima attività; `npm run couple:open` per riaprire.

### S9-4. ATTENZIONE: coppia sul server
`npm run couple:status` (21/11/2026) mostra **una sola coppia**, con membri **"Alfa" e "Nikole"** (creata 21/11 alle 11:02 UTC, 1 pensiero, 1 umore): sembra una coppia di PROVA rimasta, **non quella di Leonardo**. Se l'app di Leonardo dice "Questo telefono non è più nel posto", il posto vero non esiste più sul server: serve un nuovo codice (Noi → crea). Claude non ha cancellato nulla.


## Sessione 10 — Zona piccante (passo-passo)

### S10-0. Già fatto da Claude
- Database: `sessione10-piccante.sql` applicato (`db:apply`); `backend:sqltest` 371/371; `backend:check` 155/156 (l'unica riga rossa è il ping realtime, intermittente, già nota).
- Niente da incollare, niente da fare sul telefono di Nikole.

### S10-1. Installa la nuova app (Sideloadly)
Cavo, `Fragolina-release.ipa` (Desktop → Fragolina-build), stesso Apple ID, **"Remove extensions" spento**, "Automatic Refresh via Sideloadly Daemon" acceso. È un'installazione "sopra": i dati restano. Al primo ingresso nella zona iOS chiede il permesso Face ID: rispondi Consenti.

### S10-2. Come si entra
In **Noi**, accanto al titolo c'è un cuoricino: **3 tocchi rapidi** (entro 1,2 s l'uno dall'altro) → Face ID (o il codice del telefono). Se Face ID non c'è, la prima volta scegli un PIN di 4 cifre. Se non siete ancora in due, la zona parte in **PROVA** con una persona finta (solo sul tuo telefono).
Interruttore "Mostra la zona piccante" in Noi → Impostazioni: se spento, il gesto non fa niente. "Cancella tutto" (doppia conferma) è DENTRO la zona, in fondo.

### S10-3. Come provare da solo
Senza Nikole entri in PROVA: la persona finta ha scelto ~30 desideri (i match compaiono), risponde "sì" a "Stasera?" e ti ha regalato un buono. Cuoricini, +1, "Ops, tolgo", statistiche, traguardi, dadi, buoni, "Ho voglia" funzionano come sul vero (la persona finta non vive sul server).

### S10-4. Checklist sul telefono
- [ ] Gesto + Face ID funzionano; PIN se non c'è Face ID.
- [ ] Esci dall'app e rientra dopo > 1 minuto: la zona è richiusa; nel selettore delle app si vede la fragola che dorme.
- [ ] "+1": animazione diversa a ogni giro (5 varianti), vibrazione, cuoricino nel calendario; "Ops, tolgo" entro 10 s.
- [ ] Tocca un giorno: dove, chi ha iniziato, fiammelle, nota; si può aggiungere a un giorno passato.
- [ ] Traguardo (es. la prima volta, 5 in un giorno): festa più grande con la scritta.
- [ ] Desideri: scelta tua; con Nikole, un match fa "smack". Quello scelto da uno solo non si vede mai all'altro.
- [ ] "Ho voglia": fuori dalla zona arriva solo "Nikole ti ha mandato una fragola".
- [ ] "Stasera?": si scopre solo se siete d'accordo.
- [ ] Buoni e dadi.
- [ ] Con "Meno movimento" le animazioni sono statiche.
- [ ] Niente della zona nei widget, in Home, nei Ricordi, in "Il nostro mese".


## Sessione 11 — Ultima: pet che cresce, SideStore per tutti, codice di recupero (passo-passo)

### S11-0. Già fatto da Claude
- Database: `sessione11-recupero.sql` e `sessione11-pet-livelli.sql` applicati; `backend:sqltest` 396/396; `backend:check` 162/162 (la prima volta c'è il solito ping realtime a volte rosso).
- iloader installato sul PC (winget); canale aggiornamenti pronto nel workflow (release `latest-build`, appare dopo questa build).

### S11-1. Installa la nuova app (Sideloadly, ULTIMA volta col cavo)
Cavo, `Fragolina-release.ipa`, stesso Apple ID, "Remove extensions" spento. Claude apre Sideloadly con il file già caricato: tu premi **Start**.

### S11-2. Passa a SideStore SENZA perdere il posto (nell'ordine!)
1. Noi → **Codice di recupero** → **Crea il codice** → scrivilo/copialo ADESSO.
2. Dì a Claude "ho il codice, passo a SideStore": apre iloader.
3. Segui `NIKOLE.md` punto 1 (iloader sul tuo telefono, SideStore, poi Fragolina da SideStore).
4. Nella nuova Fragolina: Noi → **Ho un codice di recupero** → scrivi il codice → il posto torna.
5. Togli la vecchia Fragolina (quella di Sideloadly).

### S11-3. Nikole (una volta sola, dal tuo PC)
`NIKOLE.md` punto 2 (o `docs/nikole.html` sul telefono). Poi dì a Claude **"Nikole è entrata, chiudi la coppia"**.

### S11-4. Checklist
- [ ] Zona piccante → Buoni: riscatta un buono: la scritta sparisce da sola dopo 2-3 secondi, NON compare in Home/Pet/altre tab, il buono va in "Usati".
- [ ] Pet: dai un frutto: vola verso la bocca, briciole, guance piene, poi faccia felice (ogni tanto "urp!"). 3 frutti riempiono la pancia (3 pallini), il 4° dice "Sono pieno!". Dopo qualche ora torna fame.
- [ ] Pet: barra del livello sotto i bisogni; a ogni livello nuovo festa; **Guardaroba**: scegli un indumento (sbloccati dal livello 2). Lo vede anche l'altro.
- [ ] Noi → "Aggiornamento disponibile" compare solo se c'è una build più nuova della tua.
- [ ] Rinnovo da SideStore (LocalDevVPN → SideStore → 7 DAYS) e widget ancora vivi dopo.
