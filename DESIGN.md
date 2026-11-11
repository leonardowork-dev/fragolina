# DESIGN.md — Fragolina, "STICKER BOOK"

> **Ogni cosa nell'app è un adesivo che puoi staccare, premere e attaccare al mondo dell'altra persona.**

Un album condiviso: adesivi fustellati su una pagina di carta. Carino, ma fatto a mano e deciso, non il pastello generico.

## Regole di superficie
- Riempimenti **piatti**. Niente gradienti, vetro/blur, ombre sfocate, aloni, viola/indaco, card "icona in quadrato colorato", righe di card identiche, emoji come icone.
- Profondità = **ombra dura**: copia piena color inchiostro spostata di 3-4px in basso a destra, senza blur. Inclinazione dell'adesivo da -2° a +2°, deterministica per id (hash), mai casuale a ogni render.
- Stato premuto: l'adesivo trasla dentro la sua ombra (offset → 0) e scala 0.97.
- Contorno **2.5px inchiostro** su adesivi e controlli chiave (è l'identità). La carta non ha contorni. Nessun divisore a filo sottile.
- Texture: grana di carta statica (tile PNG generato, 3-4% opacità) sopra il fondo.

## Palette (token in `src/design/tokens.ts`)
| Token | Hex | Uso |
|---|---|---|
| ink | #22121F | testo, contorni, ombre dure (mai nero puro) |
| paper | #FFF4F6 | fondo |
| strawberry | #FF2D55 | accento eroe: azioni primarie, mascotte |
| strawberryDeep | #C4143A | testo accentato piccolo su carta |
| leaf | #2FBF71 | foglia, conferme |
| sky | #8FD3FF | adesivo secondario |
| butter | #FFD84D | adesivo secondario |
| blush | #FFC2CF | superficie secondaria |
Niente lilla/viola. Tinte = gradini piatti (`blushSoft` #FFE3EA, `skySoft`, `butterSoft`, `leafSoft`). Proporzioni: ~70% carta, 15% inchiostro, 10% fragola, 5% colori adesivo. Tema scuro predisposto nei token (fondo inchiostro, testo carta, stessi accenti), non predefinito.

### Contrasti (WCAG, calcolati con `scripts/contrast.mjs`)
| Coppia | Rapporto | Uso ammesso |
|---|---|---|
| ink su paper | 16.62 | tutto il testo |
| ink su blush | 11.81 | testo |
| ink su butter | 12.93 | testo |
| ink su sky | 11.01 | testo |
| ink su leaf | 7.50 | testo |
| ink su strawberry | 4.90 | testo dei bottoni primari (AA) |
| paper su ink | 16.62 | tema scuro, barre |
| strawberryDeep su paper | 5.56 | testo accentato piccolo |
| strawberry su paper | 3.39 | solo grafica e testo ≥ 24pt (AA large) |
| paper su strawberry | 3.39 | **vietato** sotto 24pt; si usa ink |
Il testo corrente è sempre inchiostro pieno, 16pt+.

## Tipografia (max 2 famiglie)
- Display: **Bagel Fat One** (confrontata con Gluten renderizzati: Bagel è più compatta e adesiva, Gluten è larga e traballante). Tracking -0.02/-0.04em, interlinea 0.95-1.05, hero 44-56pt.
- Corpo: **Figtree** (confrontata con Onest; Figtree più calda, numeri chiari). 16-17pt, interlinea 1.45.
- 3 grandezze visibili per schermata: enorme, media, piccola. Dynamic Type rispettato: niente altezze fisse, si misura. Font caricati con expo-font, render bloccato finché non sono pronti.

## Layout
Allineato a sinistra, margini pagina 20pt, cose grandi grandi. **Un elemento dominante per schermata.** Due blocchi vicini non condividono layout. Asimmetria dentro la griglia benvenuta.

## Mascotte
Fragola originale: corpo tozzo, contorno inchiostro, cappuccio foglia, due occhi a punto con riflesso, guance blush, boccuccia, bordo bianco fustellato. Stati: idle (dondolio lento), blink (ogni 3-5s, irregolare), happy (tap), sleepy, surprised, love.

## Movimento
Cancello di frequenza: cambio tab = nessuna animazione. Feedback di pressione < 150ms. Cose occasionali (sheet, toast) < 300ms. Piacere solo per momenti rari o azioni dell'utente. Tocco → molle `{duration:400, dampingRatio:1}` (sheet `{300, 0.8}`), velocità consegnata alla molla, rubber-band ai bordi, tutto interrompibile. Non-tocco: `bezier(0.23,1,0.32,1)` entrata/uscita, `bezier(0.77,0,0.175,1)` spostamenti; mai ease-in; mai scala da 0 (da 0.9 + opacità); entrata più lenta dell'uscita; stagger 30-80ms. Solo `transform`/`opacity`. Risposta al press-in, commit al press-out, target 44pt. Aptica: selection tick nei picker, Light a commit/snap, Success a azione completata; una per azione, mai unica forma di feedback. Reduced motion in ogni animazione: via traslazioni/scale/overshoot, restano opacità e colore.

## Widget: limiti del renderer
SwiftUI/WidgetKit: l'ombra dura e il contorno si disegnano con forme sovrapposte (funziona). Il font Bagel Fat One è incluso nel target widget; se il caricamento fallisce SwiftUI cade sul font di sistema `black` mantenendo palette e peso. Niente inclinazione animata, niente grana carta, niente animazioni (solo transizioni di sistema alla ricarica). In modalità "tinted/accented" di iOS 18 il sistema desatura: la mascotte resta leggibile perché ha contorno inchiostro. Lock screen: solo accessori monocromatici (glifo cuore + numero).

## Copy
Tutto italiano in `src/lib/strings.it.ts`, mai lorem ipsum.
