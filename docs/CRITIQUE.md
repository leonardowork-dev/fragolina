# Critica delle schermate (3 giri, anteprima web 390 / 430 / 360)
Screenshot: `docs/shots/final/` (finale; quelli del primo giro non sono conservati), `docs/shots/worst/` (caso peggiore).

## Giro 1 (cosa non andava)
- Onboarding: pulsante "Avanti" tagliato sul bordo basso (la KeyboardAvoidingView ignorava il padding) → contenitore interno con padding. Spazio vuoto enorme sotto i testi → anteprime vere (adesivi della Home, widget finto) invece di ornamenti.
- Onboarding: segno di spunta sul codice "Trovata" illeggibile (macchia nera) → bollino foglia con spunta.
- Home 360: "Penso a te" andava a capo ("Penso a / te") per il maxWidth che evitava la mascotte → testo a tutta larghezza (la mascotte sta in alto, il testo in basso).
- Home: nelle risposte uno slot vuoto a sinistra → cerchio "radio" visibile.
- Pet: uovo troppo piccolo e fuori asse, la "Z" toccava il contorno → uovo 300pt centrato, Z spostata fuori.
- Play: tre carte basse con metà schermo vuoto → altezze minime e più sostanza.
- Bug trovato guardando: i coriandoli a riposo, fuori schermo, allargavano la pagina web (scroll di 1482px) → layer con overflow nascosto.
- Bug: la pagina dell'onboarding non cambiava con scrollTo programmatico → pagina derivata da useAnimatedReaction (soglia), non da eventi di fine scroll.

## Giro 2
- Verificati: onboarding 1 e 3 con anteprime, Home 360 su una riga, ok. Laboratorio design completo (colori, tipografia, bottoni, mascotte in 5 stati, 8 umori, icone, effetti, sheet, toast, scheletri, movimento).
- Rimasto: "Z" del Pet ancora sul bordo → spostata; nomi lunghi nella scheda "Noi" troncati a 3 righe.

## Giro 3 (caso peggiore, 360px)
- Nomi di 34 e 43 caratteri, 46.335 giorni, zero giorni, risposta mancante, 128 pensieri: nessun testo fuori dai bordi, nessun salto di layout. La scheda "Noi" separa i nomi su due righe (ciascuna a max 2 righe, poi puntini). Il contatore a 5 cifre scala a 34pt.
- Limite noto: il "0" di Bagel Fat One è visivamente più piccolo delle altre cifre (è il disegno del carattere).
- Non verificabile su web: Dynamic Type reale (le dimensioni web non seguono la scala di iOS). Mitigazioni nel codice: `maxFontSizeMultiplier` (display 1.35x, corpo 2x), nessuna altezza fissa su testo, contatore misurato con onLayout. Da provare su iPhone con testo grande.
