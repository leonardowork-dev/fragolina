# Come mandare una nuova versione dell'app (automazione)

**Tu non devi aprire terminali.** Quando vuoi una nuova versione dell'app sul telefono, scrivi a Claude una di queste frasi:
- **"Manda una nuova build"** → Claude carica le modifiche, la fa costruire e ti mette il file pronto sul Desktop.
- **"Manda una build di sviluppo"** → versione per provare cose nuove con il PC acceso (di solito non ti serve).

## Cosa succede (lo fa Claude con `npm run ship`)
1. Salva le modifiche e le carica su GitHub (https://github.com/leonardowork-dev/fragolina).
2. GitHub costruisce l'app su un Mac nel cloud (10-20 minuti, gratis).
3. Se va bene: scarica il file `.ipa` e lo copia sul **Desktop, cartella `Fragolina-build`** (e in `build/` dentro il progetto).
4. Se va male: salva il motivo in `build/last-failure.txt`, lo legge e lo corregge.

## Cosa può dirti Claude
| Esito | Significato | Cosa fai |
|---|---|---|
| "FATTO. L'app è pronta qui: …" | Build riuscita. | Segui `scripts/SIDELOAD.md`, parte D (o parte B la prima volta). |
| "La build è FALLITA" | Errore nel codice o in GitHub. | Niente: Claude corregge e rilancia. |
| Ti mostra un codice e un sito | GitHub chiede di rifare l'accesso. | Apri il sito, scrivi il codice, premi **Authorize**, poi dillo a Claude. |

## Dove finiscono i file
- Desktop: `Fragolina-build\Fragolina-release.ipa` (quello da installare).
- Progetto: cartella `build\` (copia), `build\last-failure.txt` (solo se fallisce).
- Storico delle build: pagina **Actions** del repository su GitHub.

## Per Claude (riferimento)
`npm run ship` (= release), `npm run ship:dev` (dev-client), `npm run ship:release`. Lo script (`scripts/ship.mjs`) controlla i segreti, avvia `build-ipa.yml`, attende, scarica `Fragolina-<modo>-ipa` e copia l'IPA sul Desktop di Windows (anche da WSL). Exit code 2 = build fallita (log in `build/last-failure.txt`).

**Regole di sicurezza di ship (dalla sessione 4):**
- Non fa mai `git add`/commit da solo. Se ci sono file non salvati, li elenca in italiano e si ferma ("Prima salva il lavoro: chiedi a Claude 'fai commit di tutto'"). Solo con `--commit` esplicito (`node scripts/ship.mjs release --commit`) salva tutto lui.
- Fa `git push` solo se HEAD non è già su origin. I tentativi successivi (computer macOS occupati) restano nello stesso processo e ricompilano lo stesso commit: niente altri commit, niente altri push.
- Una sola catena alla volta: file `.ship.lock` (PID, variante, commit; ignorato da git). Una seconda catena si rifiuta e dice quale è attiva. Il lock si libera alla fine, con Ctrl+C, o da solo se il PID non esiste più.
- Se su GitHub c'è un commit più nuovo del tuo, si ferma e chiede `git pull`.
- Prove: `tests/shipGuard.test.ts` (logica in `scripts/lib/ship-guard.mjs`).

## Keepalive di Supabase (sessione 8)
`.github/workflows/keepalive.yml` gira da solo **ogni 3 giorni** (e a mano da Actions → Keepalive Supabase → Run workflow). Fa UNA chiamata leggera (`rpc/widget_feed` con un token finto) con la chiave **pubblica** dei secret già usati dalla build (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`): risponde subito `invalid_token` ma passa dal database, quindi il progetto gratuito non va in pausa dopo 7 giorni. Mai la `service_role`. Se risponde diverso da 200 il workflow **fallisce** e GitHub manda una mail: è il segnale che il progetto è in pausa (Supabase → Restore project, vedi MANUAL_TODO S8-5). Costo zero (pochi secondi di runner Linux). Se mancano i secret, `npm run ship` li rimette (vedi sopra) oppure: `gh secret set EXPO_PUBLIC_SUPABASE_URL` e `gh secret set EXPO_PUBLIC_SUPABASE_ANON_KEY` (si leggono da `.env.local`).
GitHub sospende i workflow programmati dopo 60 giorni senza attività nel repository: basta un commit (qualsiasi sessione di lavoro lo è).


## Installare l'IPA sull'iPhone di Leonardo con meno clic (22/11/2026)
Metodo che funziona (nessun commit/git necessario):
1. Telefono collegato col cavo e sbloccato. IPA: `C:\Users\UTENTE\OneDrive\Desktop\Fragolina-build\Fragolina-release.ipa` (controllare con `gh run list --workflow build-ipa.yml` che sia l'ultima build verde).
2. Da WSL, aprire Sideloadly **con l'IPA già caricato**: `powershell.exe -NoProfile -Command "Start-Process -FilePath \"$env:LOCALAPPDATA\Sideloadly\sideloadly.exe\" -ArgumentList '\"C:\Users\UTENTE\OneDrive\Desktop\Fragolina-build\Fragolina-release.ipa\"'"` (Sideloadly v0.72 accetta il percorso dell'IPA come argomento; riconosce da solo l'iPhone e l'Apple ID già salvato).
3. Controllare la finestra con uno screenshot della sola finestra (PowerShell + `CopyFromScreen`): deve mostrare l'IPA, l'iPhone e l'Apple ID, e "Start" attivo.
4. Leonardo preme **Start** (password Apple e codice a 6 cifre li chiede Sideloadly). "Remove extensions" resta spento (impostazione già salvata in Sideloadly), stesso Apple ID = stesso bundle id `app.fragolina.couple`, i dati restano.
Non usato: Sideloader CLI (Dadoum): ultima versione 1.0-pre4 di ottobre 2024 (non mantenuto), usa server anisette di terzi (rischio blocco dell'Apple ID) e può cambiare il bundle id dell'app (rischio dati/App Group). Non provato.
Non verificabile da WSL: se l'app è davvero installata (nessun `ideviceinstaller` disponibile): si vede dalla scheda Noi → "Versione 1.0.0 (build 72, …)".
