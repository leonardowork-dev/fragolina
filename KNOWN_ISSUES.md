# KNOWN_ISSUES.md
1. **Build iOS:** il minimo è iOS 16.4 (iPhone X con iOS 16.7); la build `release` è verde con quel target (`MinimumOSVersion` 16.4 nell'app e nel widget). Non provata su un iPhone con iOS 16: avvio, widget e schermata di blocco sono da verificare. La variante `dev-client` era VERDE su GitHub Actions dalla terza iterazione (11/11/2026: lockfile/npm, poi un conflitto di nome `body` nello Swift del widget). Il widget compila; non è ancora stato provato su un telefono.
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
10. **Runner macOS di GitHub spesso occupati (11/11/2026):** il pool arm64 non ha assegnato macchine per circa 9 ore (14 run annullate per mancanza di runner). `scripts/ship.mjs` riprova da solo fino a 12 volte alternando `macos-26` e `macos-15`. I runner Intel (`macos-15-intel`) non vanno: hanno solo Xcode 26.3 e Expo SDK 58 (modulo ExpoModulesJSI, Swift 6.3) non compila; la modalità Swift 5 non basta. Serve Xcode 26.4 o più recente.
11. **Upload dell'artifact:** il servizio di GitHub a volte risponde con errori temporanei; il workflow riprova una volta dopo 45 secondi.
