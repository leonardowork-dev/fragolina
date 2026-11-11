# Mettere Fragolina sull'iPhone (guida passo-passo, Windows)

Costa zero. L'app resta attiva **7 giorni**, poi va rinnovata (fine pagina: 2 minuti).
Ti serve: il PC Windows, l'iPhone, il cavo USB dell'iPhone, e il file `Fragolina-release.ipa` che trovi sul **Desktop**, nella cartella **Fragolina-build**.
(Se il file non c'è, chiedi a Claude: "manda una nuova build". Ci pensa lui.)

## A. Preparazione (si fa una volta sola)

**1. Un Apple ID "di servizio".** Meglio non usare quello principale.
   1. Sul PC apri il browser e vai su `https://account.apple.com`.
   2. Premi **Crea il tuo Apple Account**, compila e conferma l'email con il codice che ti arriva.
   3. Segnati email e password: ti servono al passo 5.

**2. Installa iTunes e iCloud dai siti Apple (non dal Microsoft Store!).**
   1. Vai su `https://www.apple.com/it/itunes/` e scorri in fondo fino a "Cerchi altre versioni?". Scarica **iTunes per Windows** (versione 64 bit) e installalo (sempre "Avanti").
   2. Vai su `https://support.apple.com/it-it/103246`, cerca il link "Scarica iCloud per Windows dal sito Apple" (NON il Microsoft Store) e installa.
   3. Riavvia il PC.

**3. Installa Sideloadly.**
   1. Vai su `https://sideloadly.io` e premi **Download for Windows**.
   2. Apri il file scaricato e segui "Next/Install" fino alla fine.

**4. Prepara l'iPhone.**
   1. Collega l'iPhone al PC con il cavo.
   2. Sull'iPhone sbloccalo e tocca **Autorizza** (o "Consenti") alla domanda "Autorizzare questo computer?". Inserisci il codice dell'iPhone.
   3. Se iTunes si apre da solo, puoi chiuderlo.

## B. Installare l'app

**5. Apri Sideloadly** (cerca "Sideloadly" nel menu Start).
   1. In alto a sinistra, sotto "iDevice", deve comparire il tuo iPhone. Se non compare: scollega e ricollega il cavo, sblocca il telefono.
   2. Nel campo **Apple Account** scrivi l'email dell'Apple ID di servizio.
   3. Trascina il file `Fragolina-release.ipa` (dal Desktop > Fragolina-build) dentro la finestra di Sideloadly, sul riquadro "IPA".
   4. Premi **Advanced Options** e controlla che **Remove extensions** (o "Remove app extensions") sia **SPENTO**. Il widget è un'estensione: se la togli, il widget non c'è.
   5. Premi **Start**.
   6. Quando chiede la password dell'Apple ID, scrivila. Se arriva un codice a 6 cifre su un altro dispositivo Apple, scrivilo.
   7. Aspetta la scritta **Done** in fondo (1-3 minuti).

**6. Attiva la Modalità sviluppatore sull'iPhone** (solo se te la chiede).
   1. Sull'iPhone: **Impostazioni → Privacy e sicurezza**.
   2. Scorri in fondo, tocca **Modalità sviluppatore**, attivala, tocca **Riavvia**.
   3. Dopo il riavvio tocca **Attiva** e inserisci il codice.
   (Se la voce non c'è, fai prima il passo 5: compare dopo la prima installazione.)

**7. Fidati del tuo "sviluppatore".**
   1. Sull'iPhone: **Impostazioni → Generali → VPN e gestione dispositivo**.
   2. Sotto "App sviluppatore" tocca la tua email.
   3. Tocca **Autorizza** e conferma.

**8. Apri Fragolina** (icona fragola nella schermata Home). Parte l'introduzione: premi **Avanti** fino a **Entra**.

## C. Il widget

**9. Aggiungilo alla Home.**
   1. Tieni premuto il dito su uno spazio vuoto della Home finché le icone tremano.
   2. Tocca **+** in alto a sinistra.
   3. Cerca **Fragolina**, scegli la misura (piccolo o medio) e tocca **Aggiungi widget**, poi **Fine**.

**10. LA PROVA (importante).**
   1. Apri Fragolina e premi il grande bottone rosso **Penso a te** una volta (vedrai i cuori).
   2. Torna alla Home e guarda il widget (aspetta fino a 10 secondi).

   | Cosa vedi | Cosa significa | Cosa fai |
   |---|---|---|
   | Il numero dei pensieri è aumentato (es. "3 pensieri oggi") e c'è la faccina | Funziona tutto. | Niente, è fatta. |
   | La fragola che dorme con "Ancora niente" o "Dorme da un po'" | Il widget non riceve i dati dall'app (limite dell'Apple ID gratuito). | Scrivi a Claude: **"il widget dorme"**. Passa alla soluzione B, ci pensa lui. |
   | Il widget non c'è nell'elenco | L'installazione non ha incluso il widget. | Rifai il passo 5 controllando il punto 4 (Remove extensions spento). |
   | Il widget è vuoto/grigio per qualche secondo | Si sta caricando. | Aspetta 10 secondi, poi riguarda. |

## D. Ogni 7 giorni (rinnovo, 2 minuti)
1. Collega l'iPhone al PC con il cavo e sbloccalo.
2. Apri Sideloadly.
3. Trascina di nuovo `Fragolina-release.ipa` e premi **Start** (stesso Apple ID). I tuoi dati restano.
Se vedi "maximum number of apps": hai superato il limite di Apple (10 per settimana). Aspetta qualche giorno e riprova.
Se l'app non si apre e dice "non disponibile": sono passati i 7 giorni. Fai il rinnovo qui sopra.

## E. Se qualcosa non va
Scrivi a Claude cosa vedi (anche solo "non parte"): leggerà i messaggi di Sideloadly e ti dice cosa fare.
