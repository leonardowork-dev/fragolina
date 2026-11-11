# DECISIONS.md (cosa, perché, alternativa)
- **Cartella di lavoro `~/fragolina` (ext4 di WSL) + copia in `Documents/Claude/Progetti/fragolina`.** Perché: `npm install` e Metro su `/mnt/c` sono lentissimi e i binari Linux non servono su Windows. Alternativa: lavorare direttamente su `/mnt/c`. La copia (senza node_modules) si rifà con `rsync`.
- **Expo SDK 58 (stabile al 11/11/2026)**, installato con `npx expo install`. Alternativa: nessuna (richiesto "ultima stabile").
- **@bacons/apple-targets + widget SwiftUI**, non expo-widgets. Perché: stato "stable/alpha" contraddittorio e serve leggere il group id a runtime (rischio sideload). Dettagli in `docs/RESEARCH.md`.
- **Modulo nativo locale `modules/group-resolver`** (scrive il JSON nel gruppo risolto) invece di `ExtensionStorage` di apple-targets: ExtensionStorage usa un group id fisso; il nostro prova i gruppi del provisioning profile.
- **Bagel Fat One + Figtree.** Renderizzati accanto a Gluten e Onest: Bagel è più compatto e "adesivo", Gluten largo e traballante; Figtree più caldo di Onest.
- **Mascotte, adesivi umore, uovo e icone in `react-native-svg`, non Skia.** Perché: funzionano identici su iPhone e nel browser senza caricare il wasm. Skia resta per la tela Disegna (richiesto) e per la sessione 5 (doodle → immagine per il widget).
- **Tela Skia con `SkPathBuilder`** (Skia 2.14: `SkPath` è immutabile). Il tratto in corso vive su shared value (thread UI); si consegna una stringa SVG al React state solo a fine tratto.
- **`public/canvaskit.wasm` non è nel repository** (8 MB): lo copia `scripts/setup-web.mjs` (postinstall). Serve solo per l'anteprima web.
- **Tab bar personalizzata su `Tabs` di Expo Router con `animation: "none"`**, non NativeTabs. Perché: il disegno richiesto (adesivo con macchia che scorre) non è realizzabile con la barra nativa. Costo: niente tab bar di sistema.
- **Sheet su `Modal` + gesture handler** (scrim piatto, chiusura per velocità o proiezione). Alternativa: `formSheet` nativo: non permette lo stile adesivo né la scelta della molla.
- **Slot artwork con manifest generato (`scripts/sync-user-art.mjs`)**: Metro vuole `require` statici, quindi lo script genera `src/lib/userArt.generated.ts` solo per i file esistenti.
- **Stato in zustand con `persist` su AsyncStorage** (non secure-store): non ci sono segreti. `expo-secure-store` è installato per il codice di coppia della sessione 2.
- **L'umore di Nikole si sceglie con lo sheet "Come si sente Nikole?" (dati di prova)**, come da specifica. Nella sessione 2 la tessera diventa sola lettura e la scelta del proprio umore si sposta altrove.
- **Giorni insieme calcolati dal widget da `startDate`** (non dall'app): scattano a mezzanotte anche con l'app chiusa.
- **Workflow su `macos-26`, Xcode 26.6, `ldid` per rifirmare con gli entitlement** (così il sideloader vede l'App Group). Alternativa: nessun fake-sign; scartata perché l'IPA perderebbe l'entitlement.
- **Repo GitHub: non creato da me.** Un primo tentativo il 10/11 era stato bloccato dal sistema (repo pubblico). Creare un repository è un'azione esterna che non ho autorizzazione a fare da solo: passi in `MANUAL_TODO.md`. Raccomandato PUBBLICO (minuti macOS gratis), vedi `docs/RESEARCH.md`.
- **Skill "impeccable" non eseguita come script**: ho applicato i suoi principi a mano (PRODUCT.md/DESIGN.md scritti da me, critica con screenshot). Nessuna alternativa tecnica persa.

- **Repo GitHub creato (11/11/2026, su richiesta esplicita di Leonardo): https://github.com/leonardowork-dev/fragolina (pubblico).** Autori della storia riscritti con l'email noreply di GitHub (niente email personale nel repo pubblico).
