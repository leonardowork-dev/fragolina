# CLAUDE.md — Fragolina

## Visione
App privata per due persone (Leonardo, Nikole): widget condivisi, mascotte (fragola originale), umore, "penso a te", disegni, mini giochi. Mai sull'App Store. Il nome è `APP_NAME` in `src/config/couple.ts`.

## Vincoli
Costo zero (nessun servizio o dipendenza a pagamento). Sviluppo su Windows (PowerShell, script Node). Solo iPhone iOS 17+. Installazione per sideload con Apple ID gratuito (scade ogni 7 giorni). Build solo su GitHub Actions (macOS), IPA **non firmato**. Nessun personaggio o marchio esistente: i simboli della coppia arrivano in `assets/user-art/`.

## Architettura
- `app/` rotte Expo Router (sottili: importano da `src/features`). `(tabs)` = home, pet, draw, play, us; `onboarding`; `design-lab` (nascosta).
- `src/design` tokens, ThemeProvider, primitive (Text, Sticker, Button, Chip, Avatar, Badge, Sheet, Toast, EmptyState, Skeleton, StickerSwitch), effetti (HeartBurst, Confetti, Sparkle), mascotte, icone, layout (Screen, TabBar, Grain, SplashOverlay).
- `src/features` home, pet, draw, play, us, onboarding, lab, widgetSync.
- `src/state` zustand persistito: `coupleStore` (forma del dato reale, oggi finto), `settingsStore`.
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
Processo isolato: niente hook, niente stato dell'app, **solo dati già calcolati** (JSON `WidgetSnapshot` in `src/lib/widgetBridge.ts`). Il widget calcola da solo i giorni da `startDate`. Stati vuoto/non aggiornato (> 48 h) = fragola che dorme. `GroupResolver.swift` esiste in due copie (modulo e widget): tienile uguali. Famiglie: small, medium, accessory (circular, rectangular, inline).

## Convenzioni
TypeScript strict, ESLint (`--max-warnings=0`) e `tsc` puliti prima di ogni commit. Stringhe solo in `strings.it.ts`. Nessun segreto nel repo (`.env.local`). Commit chiari a ogni fase. Colori e misure solo dai token. Ogni controllo ha `accessibilityLabel` e ruolo; target ≥ 44pt.

## Roadmap
1. Fondamenta + design system + shell (**fatto, sessione 1**).
2. Supabase: pairing con codice e realtime (sostituisce le action di `coupleStore`; usa `applyRemote`; codice in `expo-secure-store`).
3. Widget veri: umore e "penso a te" reali.
4. Pet condiviso.
5. Doodle → widget (Skia `makeImageSnapshot`).
6. Mini giochi.
7. Extra: countdown, domanda del giorno vera, distanza, ricordi.
8. Rifinitura: suoni, transizioni, casi limite, icona vera.
9. Installazione sul telefono di Nikole + routine di rinnovo settimanale.
