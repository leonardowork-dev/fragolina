# MANUAL_TODO.md — cosa devi fare tu (passo-passo, senza terminale)

Tutto il resto lo fa Claude. Dopo ogni passo c'è scritto cosa devi vedere.

## 1. Prendi il file dell'app
1. Apri **Esplora file** (la cartella gialla nella barra di Windows).
2. A sinistra clicca **Desktop**.
3. Apri la cartella **Fragolina-build**.
4. Devi vedere il file **Fragolina-release.ipa** (circa 37 MB). Se non c'è, scrivi a Claude: "manda una nuova build".

## 2. Installa l'app sull'iPhone
Apri il file `scripts\SIDELOAD.md` (nella cartella del progetto) oppure chiedi a Claude di mostrarti la guida: sono 10 passaggi con tutti i clic (Sideloadly, Modalità sviluppatore, fiducia nello sviluppatore, widget).
Devi vedere: l'icona della fragola sulla Home e, aprendola, l'introduzione con la fragolina.

## 3. La prova del widget (la più importante)
Segui il punto 10 di `scripts\SIDELOAD.md` (premi **Penso a te** e guarda il widget).
- Il widget cambia → scrivi a Claude "il widget funziona".
- Il widget mostra la fragola che dorme → scrivi a Claude "il widget dorme".

## 4. Metti la data vera
Nell'app: tocca **Noi** (in basso a destra) → **Modifica** → imposta la data in cui state insieme → **Salva**.

## 5. Vuoi il vostro disegno al posto della fragola?
Scrivi a Claude e allega i file: li mette lui nel posto giusto e rifà l'app (formati in `assets\user-art\README.md`).

## 6. Ogni 7 giorni
Rinnovo: parte D di `scripts\SIDELOAD.md` (cavo, Sideloadly, Start).

## Per fare una nuova versione dell'app
Scrivi a Claude: "manda una nuova build". Vedi `AUTOMATION.md`.
