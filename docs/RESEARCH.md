# Ricerca: Expo, widget, CI, sideload (11/11/2026)

Base: ricerca del 10/11 (spike `coppia-app`) + verifiche del 11/11. Dove una fonte non basta c'è scritto **NON VERIFICATO**.

## 1. Expo SDK
- SDK stabile corrente: **58** (15/10/2026), React Native 0.88, React 19.3. Installato esattamente `expo ~58.0.23` e tutte le dipendenze con `npx expo install` (`npx expo install --check` pulito).
- Fonti: <https://expo.dev/changelog/sdk-58>, <https://docs.expo.dev/versions/v58.0.0/sdk/widgets/>.

## 2. expo-widgets contro @bacons/apple-targets
| | expo-widgets | @bacons/apple-targets + SwiftUI |
|---|---|---|
| Stato | **Fonti in conflitto**: blog Expo di giugno 2026 dice "stable dalla SDK 56"; le pagine docs "latest" riportano ancora l'avviso "alpha" | v5.0.0, plugin maturo, usato da molti |
| Come si scrive | JS con `@expo/ui/swift-ui`, runtime isolato (niente hook, stato, async, import, costanti top-level) | Swift/SwiftUI nostro in `targets/widget/` |
| Dati | `updateSnapshot`/`updateTimeline`; App Group con `groupIdentifier` fisso a build time | `ExtensionStorage` oppure codice nostro su `UserDefaults(suiteName:)` |
| Group id a runtime | **NON VERIFICATO** (probabilmente fisso) | Libero: lo risolviamo noi |

**DECISIONE: @bacons/apple-targets + widget SwiftUI scritto a mano.** Motivo: il rischio principale (punto 4) richiede di scegliere il group id a runtime, e solo con Swift nostro possiamo farlo anche dentro il widget. Costo accettato: Swift senza Xcode in locale, gli errori si vedono in CI.
Fonti: <https://github.com/EvanBacon/expo-apple-targets>, <https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo>, <https://reactnativerelay.com/article/react-native-ios-widgets-expo-apple-targets-2026>.

## 3. IPA non firmato su GitHub Actions
- `macos-latest` = macOS 26 arm64; usiamo `macos-26` con Xcode 26.6 (`/Applications/Xcode_26.6.app`). `macos-14` ritirato il 2/11/2026.
- Passi: `npm ci` → `expo prebuild --platform ios --clean` (genera app + target widget) → `xcodebuild archive ... CODE_SIGNING_ALLOWED=NO` → **fake-sign con `ldid -S<entitlements>`** (così gli entitlement App Group restano nel binario e il sideloader li vede) → copia `Payload/*.app` (con `PlugIns/*.appex`) in zip `.ipa` → artifact.
- Minuti: repo **pubblico** = runner standard gratis e illimitati. Repo **privato** (piano Free): 2000 min inclusi con moltiplicatore **10x** per macOS ≈ 200 min macOS/mese, cioè circa 8-12 build. Artifact: 500 MB totali. Fonte: <https://docs.github.com/en/billing/concepts/product-billing/github-actions>.
- Attenzione: in un repo pubblico gli artifact sono scaricabili da chiunque abbia un account GitHub. Nessun segreto nel codice né nell'IPA.

## 4. Sideload da Windows con Apple ID gratuito
- Sideloadly e AltStore: 3 app attive, 10 App ID ogni 7 giorni, scadenza 7 giorni. App + widget = 2 App ID per installazione (l'estensione conta). Servono iTunes e iCloud scaricati dal sito Apple.
- **Rischio chiave: l'App Group sopravvive alla riscrittura?** Fonti in conflitto, **NON VERIFICATO**:
  - AltStore riscrive i group id aggiungendo `.<TeamID>` (fonte: nota Blink/AltStore, doc Impactor "App Groups are automatically appended with your team ID").
  - Un plugin Flutter e guide terze dicono che gli Apple ID gratuiti non hanno App Groups e gli entitlement vengono tolti.
  - La chiave Info.plist `ALTAppGroups` è ricordata ma **non documentata** nelle fonti trovate.
- **Cosa fa il codice** (implementato in `GroupResolver.swift` e nel modulo nativo): non fissa mai il group id. Prova in ordine: (1) gruppi nell'`embedded.mobileprovision` effettivo, (2) `ALTAppGroups` da Info.plist, (3) qualsiasi stringa `group.*` in Info.plist, (4) il gruppo di base da config. Usa il primo per cui `containerURL(forSecurityApplicationGroupIdentifier:)` restituisce un container.
- **Se la prova sul telefono fallisce → PERCORSO B.** La prova è il passo 1 di `MANUAL_TODO.md`.

## 5. Strategia dati
**PERCORSO A (implementato, preferito):** l'app scrive un JSON (`payload`) in `UserDefaults(suiteName: gruppo risolto)`; il widget lo legge. L'app chiede `WidgetCenter.reloadAllTimelines()`. Tutto dietro `src/lib/widgetBridge.ts` (interfaccia `WidgetBridge`).

**PERCORSO B (fallback, da implementare nella sessione 2/3 solo se A fallisce):** nessun storage condiviso. Il widget Swift fa `URLSession` verso Supabase (`GET /rest/v1/widget_state?couple_id=eq.<id>` con la chiave **anon**), usando `couple_id` e URL letti da un `Config.plist` generato a build time (script in CI da variabili del workflow, non da segreti). La sicurezza sta nelle regole RLS (lettura solo della riga con `couple_id` lungo e non indovinabile; nessuna scrittura da anon). Cache dell'ultimo JSON nel widget stesso (`UserDefaults.standard` del processo widget, che esiste anche senza App Group) per i momenti offline. Limiti: il widget si aggiorna secondo il budget WidgetKit (~ogni 15-60 min), nessun refresh immediato; la chiave anon è pubblica per natura, quindi mai dati sensibili. Per cambiare percorso basta una nuova implementazione di `WidgetBridge` che invia lo stato al server invece che al container (nessuna modifica alla UI).
