// Ricorda come ottenere l'IPA (la build vera gira su GitHub Actions, non sul tuo PC).
console.log(`
COME OTTENERE L'IPA (nessun Mac necessario)
1. Metti il codice su GitHub (MANUAL_TODO.md, passo 1).
2. GitHub > Actions > "Build iOS IPA (unsigned)" > Run workflow > scegli dev-client o release.
3. A fine build (15-25 min) scarica l'artifact "Fragolina-<modo>-ipa" (zip) e estrai il file .ipa.
4. Installalo con Sideloadly (scripts/SIDELOAD.md). L'IPA NON è firmato: lo firma Sideloadly con il tuo Apple ID.
Da terminale (se hai la GitHub CLI):
  gh workflow run build-ipa.yml -f mode=dev-client
  gh run watch
  gh run download --name Fragolina-dev-client-ipa
`);
