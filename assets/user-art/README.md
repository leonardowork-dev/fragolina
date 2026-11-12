# Artwork vostro (slot)

Metti qui i vostri disegni. L'app li usa da sola se esistono; se mancano usa quelli disegnati nel codice.
Dopo aver aggiunto o tolto file lancia `npm run dev` / `npm run web` (rigenerano da soli l'elenco) oppure `node scripts/sync-user-art.mjs`.

| File | Dove si usa | Formato |
|---|---|---|
| `app-icon.png` | Icona dell'app (letta da `app.config.js`) | PNG 1024×1024, quadrato, **senza trasparenza**, angoli NON arrotondati (li fa iOS) |
| `mascot-custom.png` | Mascotte nella Home e nelle schermate vuote al posto della fragola | PNG con sfondo trasparente, 800×800 (max 1 MB), soggetto centrato con ~10% di margine |
| `sticker-1.png` … `sticker-8.png` | Gli **otto** adesivi umore, nell'ordine: felice, innamorata, stanca, affamata, stressata, giù di corda, coccole, carica | PNG trasparente, 512×512 (max 300 KB ciascuno) |

Consigli: contorno scuro e bordo bianco "da adesivo" già nel disegno; niente ombra (la mette l'app). L'artwork resta nel repository: se il repository è pubblico, è pubblico anche questo.

## Artwork per i widget (sessione 3)
| File | Dove si usa | Formato |
|---|---|---|
| `widget-mascot.png` | Nei widget al posto della fragola disegnata: stato "dorme" (a opacità ridotta), "Giorni insieme" (angolo in alto a destra / accanto al numero) | PNG con sfondo trasparente, **400×400** (max 1 MB, meglio < 150 KB), soggetto centrato con ~10% di margine, contorno scuro e bordo bianco già nel disegno, **senza ombra** (l'ombra dura la disegna il widget solo per la fragola; con il vostro disegno aggiungila nel PNG se la volete) |

- Si copia da solo nel catalogo immagini del widget a ogni build (`scripts/widget-art.js`, chiamato da `app.config.js`). Nome ESATTO: `widget-mascot.png`.
- Le **facce degli umori** (la fragola con un'espressione per ciascuno degli otto umori) restano disegnate nel codice: sono otto espressioni, non un'immagine sola. Per cambiarle servono gli otto `sticker-N.png` nell'app e un lavoro dedicato nel widget (vedi `IMPROVEMENTS.md`).
- La schermata di blocco usa solo simboli e linee (monocromatica): l'artwork non entra.
