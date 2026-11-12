# Revisione degli screenshot, sessione 2 (prova a due schede, MockBackend)
Generati con `npm run e2e` (390×844, `ROUND=n`), `W=360 H=740 npm run e2e` e `npm run worst-e2e`. Qui restano gli ultimi (`r3`, `r3-360`, `worst-360`); i round 1–2 sono nella storia di git.

## Round 1 (33 immagini) — cosa ho visto e corretto
- Il campo "Il tuo nome" mancava nella scelta iniziale: sul telefono di lei il nome di default sarebbe stato "Leonardo". Aggiunto (TextField condiviso) e testi neutri prima del collegamento ("la tua persona", "l'altra persona": sul suo telefono "Nikole" sarebbe sbagliato).
- Pager dell'onboarding: la pagina del collegamento sbordava sotto la barra dei pallini. Ora la pagina scorre dentro lo spazio disponibile (altezza misurata).
- Eroe "Penso a te" troppo fitto (4–5 righe, nomi lunghi). Ora: suggerimento max 2 righe, "N oggi · ricevuti M", ultima riga a 1 riga.
- "Indietro", "Annulla", "ha un telefono nuovo?" non allineati al margine sinistro (padding del bottone fantasma): compensato.
- WidgetMock dell'onboarding mostrava "0 giorni" senza data: ora "–".
## Round 2 (38 immagini) — stati d'errore
- Aggiunti scatti di: coppia piena, creazione senza rete, codice scaduto/rinnovato, sessione sostituita.
- Il testo "Prova senza server" finiva sotto la barra: risolto con l'altezza misurata.
- Titolo dell'avviso di sessione sostituita riscritto ("Questo telefono non è più nel posto").
## Round 3 (390 e 360) + caso peggiore
- A 360pt la seconda scelta del collegamento era tagliata: tolto il paragrafo introduttivo (le due schede si spiegano da sole).
- Caso peggiore (nomi di 24 caratteri, 10.000 pensieri ricevuti / 9.999 inviati, 36.840 giorni, partner che non ha mai risposto): titolo "Penso a te" sfiorato dalla mascotte → mascotte più in alto; riquadro umore con nome lungo troppo alto → il suggerimento non contiene più il nome, titolo su 2 righe.
