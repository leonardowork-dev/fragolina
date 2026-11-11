# Fragolina

App per due (Leonardo e Nikole): widget sulla home, mascotte, adesivi, disegni, mini giochi. Solo iPhone (iOS 16.4 o più recente: va su iPhone X con iOS 16.7), mai sullo Store, costo zero. Stile "Sticker Book": ogni cosa è un adesivo.

## Provarla su Windows (anteprima nel browser)
Requisiti: Node 20+ e Git.
```powershell
npm install
npm run web
```
Apri <http://localhost:8081>. Cinque tocchi sul titolo "Fragolina" nella Home aprono il laboratorio del design.

## Comandi
| Comando | Cosa fa |
|---|---|
| `npm run web` | anteprima nel browser |
| `npm run dev` | server per la build dev-client sul telefono |
| `npm run typecheck` / `npm run lint` | controlli |
| `npm run icons` | rigenera icona, marchio dello splash, grana di carta |
| `npm run preview-shots` | screenshot headless in `docs/shots/` |
| `npm run doctor` | controlla l'ambiente |
| `npm run clean` | cancella cache e cartelle generate |
| `npm run ship` | carica il codice, costruisce l'IPA su GitHub e lo mette sul Desktop (`ship:dev` per dev-client) |
| `npm run ipa-local-notes` | come ottenere l'IPA |

## Sull'iPhone
Vedi `MANUAL_TODO.md` (GitHub Actions → IPA non firmato → Sideloadly) e `scripts/SIDELOAD.md`.

## Documenti
`PRODUCT.md` · `DESIGN.md` · `CLAUDE.md` · `DECISIONS.md` · `KNOWN_ISSUES.md` · `docs/RESEARCH.md` · `docs/CRITIQUE.md`
