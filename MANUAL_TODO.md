# MANUAL_TODO.md (in ordine di priorità; comandi per PowerShell su Windows)

## 1. Metti il codice su GitHub (serve per costruire l'IPA)
Perché: la build iOS gira sui Mac di GitHub. Un repository **pubblico** ha i minuti macOS gratis e illimitati; uno privato ne ha circa 200 al mese (≈ 8-12 build). Nel repo non c'è nessun segreto. Se lo vuoi privato, cambia `--public` in `--private`.
```powershell
cd C:\Users\UTENTE\Documents\Claude\Progetti\fragolina
gh auth login            # una volta sola, scegli GitHub.com > HTTPS > browser
git init                 # solo se la cartella non ha già .git
gh repo create fragolina --public --source . --remote origin --push
```
Risultato atteso: il repository esiste su github.com/<tuo-utente>/fragolina e contiene `.github/workflows/build-ipa.yml`.
(Se non hai `gh`: crea il repo vuoto sul sito, poi `git remote add origin <url>` e `git push -u origin main`.)

## 2. Primo build dell'IPA
```powershell
gh workflow run build-ipa.yml -f mode=dev-client
gh run watch
```
Risultato atteso: run verde in 15-25 minuti. Se è rosso: `gh run view --log-failed` e passami l'errore (nelle KNOWN_ISSUES c'è il punto 1: è probabile qualche correzione al Swift).
Scarica l'IPA: `gh run download --name Fragolina-dev-client-ipa` → file `Fragolina-dev-client.ipa`.

## 3. Installa sull'iPhone (Sideloadly)
Segui `scripts/SIDELOAD.md`. Risultato atteso: icona fragola sulla home, app che si apre sull'onboarding.

## 4. PROVA DECISIVA: il widget riceve i dati?
1. Apri l'app, finisci l'onboarding, premi "Penso a te" una volta.
2. Tieni premuto sulla home → "+" → Fragolina → aggiungi piccolo e medio.
3. Risultato atteso: l'adesivo umore di Nikole, il conteggio e i giorni. **Se vedi la fragola che dorme**, l'App Group non è passato con l'Apple ID gratuito: dimmelo, passo al percorso B.

## 5. Sistema i dati veri
Apri `src/config/couple.ts` e metti la vera `RELATIONSHIP_START_DATE` (AAAA-MM-GG). Cambiare nomi o nome app: stesso file (`APP_NAME`, `ME_NAME`, `PARTNER_NAME`). Oppure dall'app: tab Noi → Modifica (la data si salva sul telefono).

## 6. Anteprima e sviluppo su Windows
```powershell
cd C:\Users\UTENTE\Documents\Claude\Progetti\fragolina
npm install
npm run web          # anteprima nel browser su http://localhost:8081
npm run typecheck ; npm run lint
npm run preview-shots   # con `npm run web` acceso in un'altra finestra; salva in docs\shots\latest\
```
Risultato atteso: l'app si apre nel browser. Se `preview-shots` non trova il browser: `$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"`.

## 7. Il vostro artwork (quando vuoi)
Metti i file in `assets\user-art\` (nomi e formati in `assets\user-art\README.md`), poi `git add . ; git commit -m "artwork"; git push` e rilancia il build. L'icona viene letta da `app-icon.png`.

## 8. Ogni 7 giorni
Rinnovo dell'installazione (Sideloadly, vedi `scripts/SIDELOAD.md`).
