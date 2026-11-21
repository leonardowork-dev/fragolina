# Rinnovare e aggiornare Fragolina senza PC (SideStore)

Con un Apple ID gratuito l'app smette di aprirsi dopo **7 giorni**. In **Noi** e in **Home** Fragolina dice quando scade; il widget, l'ultimo giorno, mostra "rinnovami". Se scade: non si apre, ma i dati restano; rinnova e riparte.

## Rinnovo (ogni 6 giorni, 30 secondi)
1. **Wi-Fi** acceso (non i dati mobili).
2. **LocalDevVPN** → **Connect**.
3. **SideStore** → **My Apps** → tocca il contatore (**7 DAYS**) di Fragolina. Aspetta la fine.
4. Puoi disconnettere la VPN.

**Quasi automatico (facoltativo):** SideStore prova a rinnovare da solo in background, ma **non è garantito** (iOS decide, e la VPN deve essere accesa). Un modo che molti usano: l'app **Comandi** → *Automazione* → ogni giorno alle 12:00 → *Apri app* **LocalDevVPN** (connetti) → *Apri* `sidestore://` → attendi. Funziona solo se il telefono è sbloccato e sulla Wi-Fi: fidati dei 6 giorni del promemoria (`docs/rinnovo-fragolina.ics`), non solo dell'automazione.

## Aggiornare Fragolina
Quando Claude fa una build nuova, la mette su GitHub (canale `latest-build`). In **Noi** compare **"Aggiornamento disponibile (build N)"** → **Aggiorna con SideStore**: si apre SideStore e installa sopra (i dati restano). Serve LocalDevVPN acceso. Se non si apre da solo: SideStore → **+** → scegli l'IPA scaricato da `https://github.com/leonardowork-dev/fragolina/releases/tag/latest-build` (file `Fragolina.ipa`).
Nota: non ci sono notifiche; l'avviso si vede aprendo **Noi** (si controlla al massimo ogni 6 ore).

## Se SideStore non va
- **Accesso fallito** → Impostazioni di SideStore → **Anisette URL**: cambia server.
- **File di abbinamento scaduto** (dopo un aggiornamento di iOS o "a caso") → serve il PC una volta: iloader → ricollega (chiedi a Claude).
- **Piano B**: Sideloadly via cavo, come prima (`scripts/SIDELOAD.md`).
- Limiti Apple gratuito: 3 app (SideStore + Fragolina = 2) e 10 App ID a settimana (Fragolina usa 2 per la sua estensione widget, SideStore 1).

## Promemoria
Apri `docs/rinnovo-fragolina.ics` (doppio clic su Windows, o mandalo a Nikole): promemoria ogni 6 giorni. Su iPhone: apri il file → **Aggiungi tutto**.
Dettagli, fonti e rischi: `docs/RENEWAL.md`.
