# Fragolina: SideStore una volta sola, poi basta PC (sessione 11)

Idea: il telefono si collega al PC **una volta sola** per mettere **SideStore**. Poi il rinnovo ogni 7 giorni e gli aggiornamenti di Fragolina si fanno **dal telefono**.
Ordine (importante, non cambiarlo):

## 0. Prima di tutto: Leonardo (sul SUO telefono, ancora con Sideloadly)
1. Apri Fragolina → **Noi** → scheda **Codice di recupero** → **Crea il codice**.
2. **Scrivilo o copialo subito** (es. nelle note del telefono). Vale 14 giorni e una volta sola.
3. Dì a Claude: "ho il codice di recupero, passo a SideStore".

## 1. Leonardo passa a SideStore (PC, una volta)
1. Collega il TUO iPhone, sbloccalo, tocca **Autorizza**.
2. Apri **iloader** (già installato sul PC). Accedi con il TUO Apple ID → **Install SideStore (Stable)**.
3. Sul telefono: **Impostazioni → Generali → VPN e gestione dispositivo** → tocca la tua email → **Autorizza**. **Impostazioni → Privacy e sicurezza → Modalità sviluppatore** → attiva → riavvia → **Attiva**.
4. Apri **LocalDevVPN** → **Connect**. Apri **SideStore**, accedi con lo stesso Apple ID.
5. Porta `Fragolina-release.ipa` sul telefono (AirDrop, o dalla cartella OneDrive → app **File**). In SideStore: **+** → scegli il file.
6. Apri la **nuova** Fragolina → **Noi** (senza collegamento) → **Ho un codice di recupero** → scrivi il codice → **Riprendi il mio posto**. Fine: coppia, pet e ricordi sono tornati.
7. Cancella la **vecchia** Fragolina (quella di Sideloadly): tieni premuta l'icona → Rimuovi app.

## 2. Nikole (PC di Leonardo, una volta)
Serve: il suo iPhone (iOS 16.4 o più nuovo), il cavo, il suo **Apple ID gratuito** (meglio uno secondario, diverso da quello di Leonardo; creane uno su account.apple.com).
1. Collega il suo iPhone, sbloccalo, **Autorizza**. Apri **iloader**, accedi con il **suo** Apple ID → **Install SideStore (Stable)**.
2. Sul suo telefono: stessi passi 3, 4 e 5 del punto 1 (Autorizza, Modalità sviluppatore, LocalDevVPN, SideStore, `+` → `Fragolina-release.ipa`).
3. Apri Fragolina, scrivi il **suo nome**, **Ho un codice**, scrivi il codice di 6 lettere che Leonardo crea in **Noi**.
4. Devi vedere: due fragole, coriandoli, "Eccovi." (anche sul telefono di Leonardo).

## 3. Chiudere la coppia (Leonardo)
Quando Nikole è dentro, scrivi a Claude: **"Nikole è entrata, chiudi la coppia"**. Claude fa `npm run couple:close` e controlla con `npm run couple:status`.

## I widget
- **Home:** tieni premuto 2 secondi su uno spazio vuoto finché le icone tremano → **+** → **Fragolina** → **Aggiungi widget**.
- **Blocco:** tieni premuto sulla schermata di blocco → **Personalizza** → sotto l'ora → **Fragolina**.

## Da qui in poi, niente PC
- **Rinnovo** ogni 6 giorni e **aggiornamenti**: vedi `RINNOVO.md`.
- Se qualcosa va storto: sotto, e poi scrivi a Claude cosa vedi.

| Cosa vedi | Cosa fai |
|---|---|
| iloader non vede il telefono | Cavo diverso, sblocca, **Autorizza**, riapri iloader. |
| "Impossibile verificare l'app" | Impostazioni → Generali → VPN e gestione dispositivo → Autorizza. |
| SideStore non riesce ad accedere | Impostazioni di SideStore → cambia **Anisette URL** e riprova. Aspetta qualche ora se persiste. |
| "App non disponibile" (scaduta) | Apri LocalDevVPN → Connect → SideStore → tocca **7 DAYS**. I dati restano. |
| "Il codice non esiste" / "scaduto" | Leonardo: Noi → **Nuovo codice**. |
| Il widget non c'è / dorme | Scrivi a Claude "il widget dorme". |
