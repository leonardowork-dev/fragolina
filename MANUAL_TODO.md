# MANUAL_TODO.md — cosa devi fare tu (passo-passo, anche se non hai mai usato un terminale)

Tutto il resto lo fa Claude. Dopo ogni passo c'è scritto **cosa devi vedere**. Se qualcosa non torna, scrivi a Claude cosa vedi (anche solo "non c'è il pulsante").
Costo: **zero** (Supabase ha un piano gratuito che basta e avanza per due persone; non ti chiede la carta di credito).

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
