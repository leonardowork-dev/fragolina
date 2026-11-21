# Rinnovo settimanale: confronto e scelta (21/11/2026)

Con un Apple ID gratuito l'app **smette di aprirsi dopo 7 giorni**. Va firmata di nuovo (stesso IPA, stesso Apple ID) su **tutti e due** i telefoni.
Fonti lette oggi: [docs SideStore – install](https://docs.sidestore.io/docs/installation/install), [prerequisiti](https://docs.sidestore.io/docs/installation/prerequisites), [FAQ](https://docs.sidestore.io/docs/faq), [guida iloader](https://iloader.site/guides/install-sidestore-windows-pc/), [Sideloadly FAQ](https://sideloadly.io/faq) e [changelog](https://sideloadly.io/changelog). Dove una fonte non basta c'è scritto **NON VERIFICATO**.

## a) Sideloadly con aggiornamento automatico (demone)
- Si spunta "Automatic Refresh via Sideloadly Daemon" quando si installa. Serve la sincronizzazione Wi-Fi di iTunes attiva (iTunes → telefono → Riepilogo → "Sincronizza con questo iPhone via Wi-Fi"), iTunes scaricato dal sito Apple (non dal Microsoft Store), il **PC acceso** con il demone in esecuzione (icona nella barra) e il telefono **sulla stessa rete Wi-Fi**.
- Se il demone non parte all'avvio del PC il rinnovo automatico non funziona. Ripiego: "Refresh All Apps Manually" via cavo.
- Con due telefoni e due Apple ID: si può, ma il telefono di Nikole dovrebbe stare sulla Wi-Fi di casa di Leonardo con il PC acceso. **Non è il suo caso** (NON VERIFICATO dove abita; se abitano insieme è la scelta più semplice).
- Pro: già provato sul telefono di Leonardo, i dati restano. Contro: dipende dal PC acceso e dalla rete di casa.

## b) SideStore (rinnovo sul telefono, senza PC dopo la prima volta)
- Si installa **una volta** dal PC con **iloader** (gratuito, Windows/macOS/Linux; richiede iTunes da Apple): cavo, Apple ID, "Install SideStore (Stable)". Poi sul telefono: fidati dello sviluppatore, Modalità sviluppatore, apri **LocalDevVPN** → Connect, apri SideStore, accedi con lo stesso Apple ID, My Apps → tocca "7 DAYS" per rinnovare.
- iOS: la pagina di install elenca 15.0–15.8.6, **16.0–17.7.7**, 18.0+. iOS 16.7 (iPhone X di Leonardo) è coperto.
- Dopo la prima volta il PC non serve più (serve solo se il file di abbinamento scade: dopo un aggiornamento/ripristino di iOS, o "a caso", dice la guida). SideStore rinnova da solo in background; la FAQ non dà la frequenza né dice se in background serve la VPN accesa. Il prerequisito dice che la VPN serve "per installare, aggiornare o rinnovare". **Realisticamente: ogni 5-6 giorni apri LocalDevVPN (Connect), apri SideStore e tocca il contatore**.
- Limiti (FAQ): **3 app** attive (SideStore conta) e **10 App ID a settimana**. Fragolina = 2 App ID (app + estensione widget) + SideStore = 1 → **3 su 10**, 2 app su 3. La FAQ non dice come contano le estensioni: la stima è mia (NON VERIFICATO).
- Serve Wi-Fi (non dati mobili). Problemi noti: errori di login per i server Anisette (si cambia l'URL nelle impostazioni), SideStore è in beta pubblica.
- Un secondo iPhone con un altro Apple ID: la documentazione non lo dice, ma ogni telefono ha il suo SideStore installato dal PC con il suo Apple ID (NON VERIFICATO).
- **Rischio specifico Fragolina (NON VERIFICATO):** SideStore ri-firma l'IPA e, dice la FAQ, può usare un identificativo di gruppo diverso. Il `GroupResolver` lo trova a runtime (profilo → `ALTAppGroups` → `group.*` → base), quindi il widget dovrebbe funzionare; va provato sul telefono dopo la prima installazione. Se il bundle id cambia rispetto a Sideloadly, passare da un metodo all'altro **crea un'app nuova** (sessione persa: serve un nuovo codice di collegamento).

## c) Altro
- AltStore classico: stessa idea di SideStore ma richiede un computer (AltServer) acceso in rete: peggio. Niente altro di gratuito e affidabile che io conosca per Apple ID gratuiti.

## Scelta
**SideStore per tutti e due**, perché è l'unico che non dipende da un PC acceso nella stessa rete: per Nikole (lontana dal PC di Leonardo) è l'unico modo realistico.
- **Nikole:** nella sessione 11 si installa SideStore con iloader dal PC di Leonardo, poi Fragolina da dentro SideStore (stesso IPA). Da lì in poi rinnova da sola con il telefono.
- **Leonardo:** **non migrare subito.** Resta con Sideloadly (con "Automatic Refresh" spuntato e iTunes Wi-Fi sync) finché SideStore non ha dimostrato, sul telefono di Nikole, che il widget funziona e che il rinnovo è semplice. Migrare dopo = app nuova se cambia il bundle id: nuovo codice di collegamento.
- Piano B se SideStore dà problemi: Sideloadly via cavo ogni settimana, come oggi (`scripts/SIDELOAD.md`).
- Per la scadenza l'app la mostra da sola (Noi, Home, widget "rinnovami") leggendo il profilo di firma: vale per entrambi i metodi.

## Cosa resta da fare a mano (non si può dal PC)
Installare SideStore sul telefono richiede il telefono collegato e la password Apple: sessione 11 per Nikole. Le guide sono pronte: `NIKOLE.md`, `docs/nikole.html`, `RINNOVO.md`, `docs/rinnovo-fragolina.ics`.
