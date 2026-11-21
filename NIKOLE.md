# Fragolina sul telefono di Nikole (sessione 11)

Si fa una volta sola, con il PC di Leonardo. Ci vogliono circa 30 minuti. **Non si installa niente prima.**

## Cosa serve
- Il telefono di Nikole (iPhone con **iOS 16.4 o più nuovo**: Impostazioni → Generali → Info → Versione software; se è più vecchio, aggiorna iOS da Impostazioni → Generali → Aggiornamento software).
- Il suo **cavo** e il **PC di Leonardo**.
- Un **Apple ID gratuito suo**, diverso da quello di Leonardo (meglio uno secondario, creato su account.apple.com). Email e password a portata di mano.
- Il file `Fragolina-release.ipa` (Desktop → Fragolina-build) e il **codice di 6 lettere** di Leonardo (Noi → crea il posto).

## Sul PC
1. Servono **iTunes** e **iCloud** scaricati dal sito Apple (non dal Microsoft Store): vedi `scripts/SIDELOAD.md`, parte A.
2. Metodo consigliato, **SideStore** (così rinnova da solo dal telefono): installa **iloader** (cerca "iloader" sul sito ufficiale), collega il telefono col cavo, sbloccalo, tocca **Autorizza**. In iloader accedi con l'**Apple ID di Nikole** e premi **Install SideStore (Stable)**.
   - Piano B (più semplice, rinnovo a mano ogni settimana): **Sideloadly**, `scripts/SIDELOAD.md`, con l'Apple ID di Nikole e **"Remove extensions" SPENTO**.

## Sul telefono
3. **Impostazioni → Generali → VPN e gestione dispositivo** → sotto "App sviluppatore" tocca l'email → **Autorizza**.
4. **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** → attiva → **Riavvia** → dopo il riavvio **Attiva** e metti il codice. (La voce compare solo dopo la prima installazione.)
5. Con SideStore: apri **LocalDevVPN** → **Connect**; apri **SideStore**, accedi con lo stesso Apple ID; tocca **+** e scegli `Fragolina-release.ipa` (mandalo sul telefono con AirDrop/Dropbox/cavo).
6. Apri **Fragolina**. Premi **Avanti** fino a **Entra**. Scrivi il **tuo nome**, premi **Ho un codice**, scrivi i 6 caratteri di Leonardo → **Entra**.
7. Devi vedere: due fragole, coriandoli, "Eccovi." (anche su quello di Leonardo).

## I widget
- **Home:** tieni premuto 2 secondi su uno spazio vuoto finché le icone tremano → **+** in alto a sinistra → cerca **Fragolina** → scegli e **Aggiungi widget** → **Fine**.
- **Blocco:** tieni premuto sulla schermata di blocco → **Personalizza** → tocca sotto l'ora → **Fragolina**.
- Prova: apri Fragolina, premi **Penso a te**, torna alla Home e guarda il widget (fino a 10 secondi).

## Se qualcosa va storto
| Cosa vedi | Cosa fai |
|---|---|
| iloader/Sideloadly non vede il telefono | Cavo diverso, sblocca, tocca "Autorizza", riavvia iTunes. |
| "Impossibile verificare l'app" / "Sviluppatore non attendibile" | Passo 3 (VPN e gestione dispositivo → Autorizza). |
| L'app non parte, o manca la voce Modalità sviluppatore | Passo 4: prima prova a installare, poi la voce compare. |
| Errore di login Apple / "too many apps" | Aspetta qualche ora e riprova; usa un Apple ID usato poco. Max 10 App ID a settimana. |
| "Il codice non esiste" / "scaduto" | Leonardo: Noi → **Nuovo codice**. |
| "App non disponibile" dopo 7 giorni | È scaduta: rinnova, vedi `RINNOVO.md`. I dati restano. |
| Widget non c'è / dorme | Controlla che "Remove extensions" fosse spento, poi scrivi a Claude "il widget dorme". |

Rinnovo ogni 6 giorni: `RINNOVO.md` (+ promemoria `docs/rinnovo-fragolina.ics`).
