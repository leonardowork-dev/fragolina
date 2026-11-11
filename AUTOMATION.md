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
`npm run ship` (= release), `npm run ship:dev` (dev-client), `npm run ship:release`. Lo script (`scripts/ship.mjs`) controlla i segreti, fa commit e push, avvia `build-ipa.yml`, attende, scarica `Fragolina-<modo>-ipa` e copia l'IPA sul Desktop di Windows (anche da WSL). Exit code 2 = build fallita (log in `build/last-failure.txt`).
