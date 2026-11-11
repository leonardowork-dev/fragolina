# Installare Fragolina sull'iPhone da Windows (Sideloadly, Apple ID gratuito)

Costo zero. L'app dura **7 giorni**, poi va rinnovata (vedi sotto). Ogni installazione usa **2 App ID** (app + widget) dei 10 che Apple concede ogni 7 giorni.

## Una volta sola
1. Installa **iTunes** e **iCloud** dai siti Apple (non dal Microsoft Store): <https://www.apple.com/itunes/> e <https://support.apple.com/it-it/103246>.
2. Installa **Sideloadly**: <https://sideloadly.io>.
3. iPhone: Impostazioni → Privacy e sicurezza → **Modalità sviluppatore** → attiva e riavvia.
4. Collega l'iPhone con il cavo, tocca "Autorizza questo computer".
5. Ottieni l'IPA: `npm run ipa-local-notes` (GitHub Actions, vedi `MANUAL_TODO.md`).

## Installazione
1. Apri Sideloadly, trascina il file `.ipa`.
2. Inserisci il tuo Apple ID (meglio un ID dedicato: serve solo per firmare).
3. **NON** togliere le estensioni (opzione "Remove extensions" spenta): il widget è un'estensione.
4. Premi **Start**. A fine installazione, sull'iPhone: Impostazioni → Generali → VPN e gestione dispositivo → fidati del tuo Apple ID.
5. Aggiungi il widget: tieni premuto sulla home → "+" → Fragolina.

## Rinnovo ogni 7 giorni
- Sideloadly Daemon (icona nella barra di Windows) può rinnovare da solo se PC e iPhone sono sulla stessa Wi-Fi e Sideloadly è aperto/residente.
- Altrimenti: ricollega il telefono, riapri Sideloadly, premi Start con lo stesso IPA (i dati restano).
- Se la 8ª app/ID è bloccata: attendi che scada il limite settimanale.

## Provare i widget (importante)
Dopo l'installazione apri l'app una volta e premi "Penso a te". Poi guarda il widget: se mostra la fragola addormentata, il widget non riceve i dati (App Group non concesso dall'Apple ID gratuito) → serve il **percorso B** (vedi `docs/RESEARCH.md`, sezione 5).

## Sviluppo con Fast Refresh (build dev-client)
1. Installa la build `dev-client`.
2. Sul PC: `npm run dev`.
3. LAN: iPhone e PC sulla stessa Wi-Fi; apri l'app Fragolina → inserisci l'indirizzo mostrato (`exp://192.168.x.x:8081`).
4. Se la LAN non va (Windows Firewall/rete ospiti): `npx expo start --dev-client --tunnel` (la prima volta installa `@expo/ngrok`, gratuito).
5. Se Windows chiede il Firewall: consenti Node.js sulle reti private.
