# KNOWN_ISSUES.md
1. **Build iOS:** la variante `dev-client` è VERDE su GitHub Actions dalla terza iterazione (11/11/2026: lockfile/npm, poi un conflitto di nome `body` nello Swift del widget). Il widget compila; non è ancora stato provato su un telefono.
2. **App Group con Apple ID gratuito: NON VERIFICATO.** Se il widget mostra la fragola che dorme anche dopo aver premuto "Penso a te", va implementato il percorso B (`docs/RESEARCH.md` §5).
3. **`ios.appleTeamId` mancante**: avviso di apple-targets nel prebuild. Con firma disattivata non blocca; se la build fallisse per questo, aggiungi un Team ID finto in `app.config.js` (`ios.appleTeamId: "AAAAAAAAAA"`).
4. **Font nel widget**: `BagelFatOne.ttf` va in `targets/widget/assets/` (collegato come risorsa) e in `UIAppFonts`. Se il caricamento fallisce il widget usa il font di sistema (palette e peso restano). Il nome PostScript usato è `BagelFatOne-Regular` (da verificare sul telefono).
4b. **La build `dev-client` mostra l'app solo con il PC acceso** (carica il JavaScript da Metro). Per l'uso normale serve la `release` (`npm run ship`).
5. **Haptics, 60/120 fps, widget, sideload** non sono verificabili da qui.
6. **Anteprima web**: Dynamic Type non simulabile; gli haptics sono no-op; la tela Disegna richiede `public/canvaskit.wasm` (si copia da solo con `npm install`).
7. **Il "0" di Bagel Fat One** è visivamente più piccolo delle altre cifre (disegno del carattere).
8. `npm audit` segnala 5 vulnerabilità "moderate" nelle dipendenze di sviluppo di Expo; non toccano l'app sul telefono.
9. La Home mostra per un frame i dati di default prima che lo store persistente si carichi (coperto dallo splash animato).
10. Il laboratorio non si apre da Home se i 5 tocchi sono più lenti di 1,6 s tra l'uno e l'altro (voluto).
