# CLAUDE.md — Fragolina

## Visione
App privata per due persone (Leonardo, Nikole): widget condivisi, mascotte (fragola originale), umore, "penso a te", disegni, mini giochi. Mai sull'App Store. Il nome è `APP_NAME` in `src/config/couple.ts`.

## Vincoli
Costo zero (nessun servizio o dipendenza a pagamento). Sviluppo su Windows (PowerShell, script Node). Solo iPhone, **iOS 16.4 o più recente** (minimo reale dello stack Expo SDK 58; il proprietario ha un iPhone X fermo a iOS 16.7). Il codice nativo non deve usare API iOS 17+ senza `if #available` e un ripiego grafico. Installazione per sideload con Apple ID gratuito (scade ogni 7 giorni). Build solo su GitHub Actions (macOS), IPA **non firmato**. Nessun personaggio o marchio esistente: i simboli della coppia arrivano in `assets/user-art/`.

## Architettura
- `app/` rotte Expo Router (sottili: importano da `src/features`). `(tabs)` = home, pet, draw, play, us; `onboarding`; `design-lab` (nascosta).
- `src/design` tokens, ThemeProvider, primitive (Text, Sticker, Button, Chip, Avatar, Badge, Sheet, Toast, EmptyState, Skeleton, StickerSwitch), effetti (HeartBurst, Confetti, Sparkle), mascotte, icone, layout (Screen, TabBar, Grain, SplashOverlay).
- `src/features` home, pet, draw, play, us, onboarding, lab, widgetSync.
- `src/state` zustand persistito: `createCoupleStore` (factory: dati della coppia + motore di sincronizzazione + coda offline), `coupleStore` (istanza dell'app), `settingsStore`.
- `src/lib/backend` interfaccia `Backend` con `SupabaseBackend` (chiavi `EXPO_PUBLIC_SUPABASE_*`, sessione in expo-secure-store) e `MockBackend` (finto server in memoria / localStorage+BroadcastChannel); `getBackend()` sceglie. `src/lib/sync` funzioni pure: riduttore (LWW), coda, backoff, tipi. `src/features/pairing` collegamento (codice, attesa, festa, esci). `supabase/` migrazioni + `all.sql`.
- `src/lib` widgetBridge, haptics, storage, time, hash, strings.it (tutte le stringhe italiane), userArt.generated.
- `src/lib/pet` regole del pet (funzioni pure, solo interi, specchio SQL `_pet_step` e Swift `Model.swift`), `src/features/pet` schermata, `src/design/mascot/PetArt.tsx` il pet in 4 stadi + uovo. Backend: `get_pet`, `pet_act`, `set_pet_name` (migrazione `20261113000001_pet.sql`, file da incollare: `supabase/sessione4-pet.sql`).
- `src/lib/note` biglietto: regole pure (`rules.ts`: vettori 0-1000, semplificazione RDP, validazione ↔ SQL `_note_valid`), `sync.ts` (server + coda), `widgetModel.ts` (cosa mostrano i widget ↔ Swift). `src/lib/geo` distanza (haversine, testi). `src/features/draw` scheda Disegna = "Manda sul blocco", `src/features/distance` posizione (permesso, "Sempre", compito in background). Backend: `send_note`, `clear_note`, `get_board`, `set_location(_sharing)`, `rotate_widget_token`, `widget_feed`, `widget_set_location` (migrazione `20261114000001_note.sql`, file da incollare: `supabase/sessione5-note.sql`).
- `modules/group-resolver` modulo nativo Swift (App Group a runtime). `targets/widget` widget SwiftUI (apple-targets).
- **Dati widget — percorso A (attivo per tutto tranne biglietto e distanza, e ripiego offline):** l'app scrive JSON in `UserDefaults(suiteName: gruppo risolto)`; il gruppo si sceglie a runtime (provisioning profile → `ALTAppGroups` → qualsiasi `group.*` in Info.plist → gruppo base). **Percorso B (ATTIVO dalla sessione 5 per biglietto e distanza):** il widget scarica da solo il feed da Supabase (`widget_feed`, chiave PUBBLICA + token del widget letti dallo snapshot) nel timeline provider, con timeout ≤ 8 s e ripiego sull'ultimo dato dell'App Group. Un solo file di rete: `targets/widget/Feed.swift`. Regole del token: casuale 32 byte generato dal server, salvato come hash, mostrato una volta; il widget con chiave pubblica + token può SOLO `widget_feed` (leggere) e `widget_set_location` (scrivere la propria posizione arrotondata); chi esce dalla coppia lo perde; mai la service_role in app/widget/IPA. Dettagli in `docs/BACKEND.md`.

## Direzione artistica (sintesi, vedi DESIGN.md)
"Sticker Book": riempimenti piatti; niente gradienti, vetro, blur, glow, viola, emoji-icone, card-icona, righe di card uguali. Ombra dura inchiostro (3-6px giù-destra), contorno 2.5px, inclinazione deterministica per id (±2°). Palette ink #22121F, paper #FFF4F6, strawberry #FF2D55, leaf, sky, butter, blush. Display Bagel Fat One, corpo Figtree. Un elemento dominante per schermata. Testo in italiano, caldo e corto.

## Regole di movimento (obbligatorie)
- Cancello di frequenza: le tab non si animano. Press < 150ms; sheet/toast < 300ms; piacere solo per momenti rari o azioni dell'utente.
- Tocco → molle (`motion.spring` 400/1, `springSheet` 300/0.8), velocità consegnata, rubber-band, tutto interrompibile. Non-tocco: `motion.easeOut` / `easeInOut`; mai ease-in; mai scala da 0.
- Solo `transform` e `opacity` (eccezione: elementi assoluti senza figli). Mai animare intensità blur né elevation.
- Reanimated: `useSharedValue` con `.get()/.set()` (mai `.value`); mai `setState` da gesture o scroll; `scheduleOnRN` (mai `runOnJS`) solo in `onEnd` o in `useAnimatedReaction` a soglia, mai per frame; funzioni chiamate dai worklet iniziano con `'worklet'`; `GestureHandlerRootView` alla radice.
- Aptica: tick (selezione), light (commit/snap), success (azione completata); una per azione, sullo stesso frame, mai unico feedback. Reduced motion in ogni animazione (`useTheme().reduceMotion`).

## Windows + GitHub Actions
Sviluppo: `npm install`, `npm run web`. Build: `.github/workflows/build-ipa.yml` (`workflow_dispatch`, input `mode`: dev-client | release) → `expo prebuild` → `xcodebuild archive` con firma disattivata → `ldid -S` con gli entitlement → zip `.ipa` con l'estensione widget → artifact. Installazione: `scripts/SIDELOAD.md`.

## Regole del widget
Target minimo iOS 16.4 (app, widget, modulo). Niente `#Preview`, `onChange` a due parametri, `@Observable`, widget interattivi o `containerBackground` senza guardia `#available(iOS 17.0, *)` (vedi `StickerWidgetBackground`).
Processo isolato: niente hook, niente stato dell'app, **solo dati già calcolati** (JSON `WidgetSnapshot` **v5** in `src/lib/widgetPayload.ts`, fixture `tests/fixtures/widget-snapshot.json` (v5) + `-v4` + `-v3` + `-v2` + `-v1`: i campi si aggiungono solo in fondo). Il widget calcola da solo SOLO giorni da `startDate`, prossima ricorrenza (`src/lib/recurrence.ts` ↔ `Model.swift`, stessa regola) "X fa" e (per `FragolinaPet`) i bisogni e la faccia del pet (`src/lib/pet/rules.ts` ↔ `Model.swift`), (per `FragolinaNote`/`FragolinaDistance`) stato e testi del biglietto, scadenza e chilometri (`src/lib/note/widgetModel.ts`, `src/lib/geo/distance.ts` ↔ `Model.swift`). Stati: vuoto / non collegato / non aggiornato (> 48 h) = fragola che dorme; dati vecchi (> 3 h) = "aggiornato X fa". `GroupResolver.swift` esiste in due copie (modulo e widget): tienile uguali.
**Nove kind** (`index.swift`, diviso in pacchetti da ≤ 5 perché il costruttore del `WidgetBundle` ha quel limite: il sesto sparì dalla galleria): `FragolinaMood`, `FragolinaPing`, `FragolinaPet` (small + medium + accessoryRectangular; il widget ricalcola bisogni e faccia per ogni voce della timeline, `PetFaces.swift`), `FragolinaDays` (small + medium), `FragolinaNote` (small + medium + accessoryRectangular; biglietto, blocco monocromatico), `FragolinaDistance` (small + medium + accessoryCircular + accessoryInline), `FragolinaLock`, `FragolinaLockMood` (accessory), `FragolinaWidget` (storico, non toccare il kind). File: `Model.swift` (solo Foundation: dati, calendario, ricorrenze, date della timeline), `Strings.swift` (TUTTE le stringhe italiane del widget), `Palette.swift` (token + font + adesivo), `Faces.swift` (fragola con umori, dorme, faccina da blocco, coriandoli, slot `widget-mascot`), `Components.swift`, `Provider.swift`, un file per widget. Link: `fragolina://ping|mood|us|home|pet|draw` (`src/lib/deepLink.ts`, `app/+native-intent.ts`, `useDeepLinks`). Nessun AppIntent/widget interattivo (iOS 16). **Rete solo in `Feed.swift`** (mai in galleria/anteprima). Prove: `npm test` (palette = token, API vietate, kind, fixture v1/v2/v3), `SWIFTC=… npm run swift:check` (Swift reale ↔ TypeScript), anteprima `/widget-preview` + `node scripts/widget-shots.mjs`.

## Convenzioni
TypeScript strict, ESLint (`--max-warnings=0`) e `tsc` puliti prima di ogni commit. Stringhe solo in `strings.it.ts`. Nessun segreto nel repo (`.env.local`). Commit chiari a ogni fase. Colori e misure solo dai token. Ogni controllo ha `accessibilityLabel` e ruolo; target ≥ 44pt.

## Roadmap
1. Fondamenta + design system + shell (**fatto, sessione 1**).
2. Supabase: pairing con codice e realtime (**fatto, sessione 2**; manca solo la prova col server vero: `MANUAL_TODO.md`, `npm run backend:check`). Widget alimentato con dati veri.
3. Widget finali (**fatto, sessione 3**; manca la prova sul telefono: `MANUAL_TODO.md` "Sessione 3"): umore, penso-a-te, giorni insieme, schermata di blocco; grafica definitiva.
4. Pet condiviso (**fatto, sessione 4**; manca la migrazione su Supabase e la prova sul telefono: `MANUAL_TODO.md` "Sessione 4").
5. Biglietti sul blocco + distanza (**fatto, sessione 5**; manca la migrazione `sessione5-note.sql` e la prova sul telefono: `MANUAL_TODO.md` "Sessione 5"). I doodle "veri" nella tab Disegna sono questa stessa funzione.
6. Mini giochi.
7. Extra: countdown, domanda del giorno vera, distanza, ricordi.
8. Rifinitura: suoni, transizioni, casi limite, icona vera.
9. Installazione sul telefono di Nikole + routine di rinnovo settimanale.

## Sessione 3 — regole utili
- `ship.mjs` (dalla sessione 4) non committa mai da solo: se l'albero non è pulito si ferma e elenca i file (solo `--commit` salva tutto). Push solo se HEAD non è su origin; i ritentativi ricompilano lo stesso SHA; `.ship.lock` impedisce due catene (KNOWN_ISSUES 23 risolto). Prima di `npm run ship*`: tutto committato e pushato. Durante una catena attiva puoi lavorare, ma non toccare HEAD/branch: la build parte dallo SHA già pubblicato.
- Modifichi lo schema del widget? Aggiorna insieme: `widgetPayload.ts`, fixture, `Model.swift` (`Snapshot`), `WIDGET_SCHEMA_VERSION`, e lancia `npm test`.
- Modifichi un layout del widget? Aggiorna la replica in `src/features/lab/widgets/` e guarda `docs/shots/widgets/`.

## Sessione 2 — comandi e regole utili
- `npm test` (vitest, ~70 prove), `npm run backend:sqltest` (SQL su Postgres locale), `npm run backend:check` (end-to-end sul progetto Supabase vero; senza chiavi fa la prova a secco), `npm run backend:sql` (rigenera `supabase/all.sql`), `npm run setup-env` (crea `.env.local`), `npm run e2e` / `npm run worst-e2e` (due schede nel browser, serve `npm run web`; in WSL senza sudo imposta `CHROME_LIBS`).
- Modifichi una migrazione? Aggiungi un file nuovo in `supabase/migrations/` (mai riscrivere), poi `npm run backend:sql` e `npm run backend:sqltest`.
- Il widget NON ha percorso di rete (Percorso A confermato sul telefono): non costruirne uno.
- Min. iOS 16.x: niente API più nuove senza `#available` e ripiego.

## Sessione 4 — regole utili
- Modifichi le regole del pet? Aggiorna insieme `src/lib/pet/rules.ts`, `_pet_step` in una migrazione NUOVA, `Model.swift` (`PetRules`, `petMoodId`…), `Strings.swift`, e rigenera la sequenza di riferimento: `UPDATE_PET_FIXTURE=1 npx vitest run tests/pet.test.ts`; poi `npm test`, `npm run backend:sqltest` (parità TS↔SQL) e `SWIFTC=… npm run swift:check` (parità TS↔Swift).
- Prove nel browser (`npm run web`, `npm run e2e`): serve un backend finto → sposta temporaneamente `.env.local` (altrimenti parla col Supabase vero) e **riavvia** `expo start` dopo ogni modifica (Metro non vede i file cambiati in WSL).
- `getBackend()` ha anche `getPet/petAct/setPetName`; `getPet()` = `null` quando il server non ha la migrazione.

## Sessione 5 — regole utili
- Modifichi biglietto o distanza? Aggiorna insieme: `src/lib/note/rules.ts` (limiti), `_note_valid` in una migrazione NUOVA, `src/lib/note/widgetModel.ts` / `src/lib/geo/distance.ts` ↔ `Model.swift` (`noteDisplay`, `distance`, `haversineKm`), `Strings.swift`, snapshot (`widgetPayload.ts`, fixture, `Snapshot`), e lancia `npm test`, `npm run backend:sqltest` e `SWIFTC=… npm run swift:check`.
- `npm run backend:sqltest` rigenera `all.sql` da solo. Il file da incollare per la sessione 5 è `supabase/sessione5-note.sql` (generato da `scripts/build-sql.mjs`).
- Il token del widget sta nello snapshot (App Group) e in `useCouple().widgetToken`: mai nei log, mai nei test con valori veri.
- Prove nel browser: `CHROME_LIBS` (vedi sopra), `.env.local` spostato, riavvio di Metro; `npm run e2e` scrive in `docs/shots/session5/`.
