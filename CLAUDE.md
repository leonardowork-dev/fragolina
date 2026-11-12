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
- `modules/group-resolver` modulo nativo Swift (App Group a runtime). `targets/widget` widget SwiftUI (apple-targets).
- **Dati widget — percorso A (attivo):** l'app scrive JSON in `UserDefaults(suiteName: gruppo risolto)`; il gruppo si sceglie a runtime (provisioning profile → `ALTAppGroups` → qualsiasi `group.*` in Info.plist → gruppo base). **Percorso B (fallback, non implementato):** il widget fa fetch da Supabase con chiave anon e un couple id letto da un plist generato in CI; si attiva scrivendo una seconda implementazione di `WidgetBridge`. Dettagli in `docs/RESEARCH.md`.

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
Processo isolato: niente hook, niente stato dell'app, **solo dati già calcolati** (JSON `WidgetSnapshot` **v3** in `src/lib/widgetPayload.ts`, fixture `tests/fixtures/widget-snapshot.json` + `-v2` + `-v1`: i campi si aggiungono solo in fondo). Il widget calcola da solo SOLO giorni da `startDate`, prossima ricorrenza (`src/lib/recurrence.ts` ↔ `Model.swift`, stessa regola) e "X fa". Stati: vuoto / non collegato / non aggiornato (> 48 h) = fragola che dorme; dati vecchi (> 3 h) = "aggiornato X fa". `GroupResolver.swift` esiste in due copie (modulo e widget): tienile uguali.
**Sei kind** (`index.swift`): `FragolinaMood`, `FragolinaPing`, `FragolinaDays` (small + medium), `FragolinaLock`, `FragolinaLockMood` (accessory), `FragolinaWidget` (storico, non toccare il kind). File: `Model.swift` (solo Foundation: dati, calendario, ricorrenze, date della timeline), `Strings.swift` (TUTTE le stringhe italiane del widget), `Palette.swift` (token + font + adesivo), `Faces.swift` (fragola con umori, dorme, faccina da blocco, coriandoli, slot `widget-mascot`), `Components.swift`, `Provider.swift`, un file per widget. Link: `fragolina://ping|mood|us|home` (`src/lib/deepLink.ts`, `app/+native-intent.ts`, `useDeepLinks`). Nessun AppIntent/widget interattivo (iOS 16). Prove: `npm test` (palette = token, API vietate, kind, fixture v1/v2/v3), `SWIFTC=… npm run swift:check` (Swift reale ↔ TypeScript), anteprima `/widget-preview` + `node scripts/widget-shots.mjs`.

## Convenzioni
TypeScript strict, ESLint (`--max-warnings=0`) e `tsc` puliti prima di ogni commit. Stringhe solo in `strings.it.ts`. Nessun segreto nel repo (`.env.local`). Commit chiari a ogni fase. Colori e misure solo dai token. Ogni controllo ha `accessibilityLabel` e ruolo; target ≥ 44pt.

## Roadmap
1. Fondamenta + design system + shell (**fatto, sessione 1**).
2. Supabase: pairing con codice e realtime (**fatto, sessione 2**; manca solo la prova col server vero: `MANUAL_TODO.md`, `npm run backend:check`). Widget alimentato con dati veri.
3. Widget finali (**fatto, sessione 3**; manca la prova sul telefono: `MANUAL_TODO.md` "Sessione 3"): umore, penso-a-te, giorni insieme, schermata di blocco; grafica definitiva.
4. Pet condiviso.
5. Doodle → widget (Skia `makeImageSnapshot`).
6. Mini giochi.
7. Extra: countdown, domanda del giorno vera, distanza, ricordi.
8. Rifinitura: suoni, transizioni, casi limite, icona vera.
9. Installazione sul telefono di Nikole + routine di rinnovo settimanale.

## Sessione 3 — regole utili
- Lavorare in `~/fragolina` mentre una catena `npm run ship*` è attiva è pericoloso: `ship.mjs` fa `git add -A` e pubblica tutto (KNOWN_ISSUES 23). Usa un worktree.
- Modifichi lo schema del widget? Aggiorna insieme: `widgetPayload.ts`, fixture, `Model.swift` (`Snapshot`), `WIDGET_SCHEMA_VERSION`, e lancia `npm test`.
- Modifichi un layout del widget? Aggiorna la replica in `src/features/lab/widgets/` e guarda `docs/shots/widgets/`.

## Sessione 2 — comandi e regole utili
- `npm test` (vitest, ~70 prove), `npm run backend:sqltest` (SQL su Postgres locale), `npm run backend:check` (end-to-end sul progetto Supabase vero; senza chiavi fa la prova a secco), `npm run backend:sql` (rigenera `supabase/all.sql`), `npm run setup-env` (crea `.env.local`), `npm run e2e` / `npm run worst-e2e` (due schede nel browser, serve `npm run web`; in WSL senza sudo imposta `CHROME_LIBS`).
- Modifichi una migrazione? Aggiungi un file nuovo in `supabase/migrations/` (mai riscrivere), poi `npm run backend:sql` e `npm run backend:sqltest`.
- Il widget NON ha percorso di rete (Percorso A confermato sul telefono): non costruirne uno.
- Min. iOS 16.x: niente API più nuove senza `#available` e ripiego.
