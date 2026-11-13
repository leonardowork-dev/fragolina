/**
 * Link dei widget → azioni dell'app. Lo scheme è `fragolina://` (app.config.js). Funzioni PURE, provate in
 * tests/deepLink.test.ts. I widget usano solo questi cinque link (targets/widget/Model.swift, enum WidgetLink):
 *  - fragolina://ping  → manda UN pensiero (se collegati) e mostra la conferma; se non collegati porta a "Noi"
 *  - fragolina://mood  → apre la scelta del mio umore (se non collegati porta a "Noi")
 *  - fragolina://us    → apre "Noi"
 *  - fragolina://home  → apre la Home
 *  - fragolina://pet   → apre il Pet (anche se non siete collegati: il Pet spiega cosa manca)
 * Tutto il resto (o un link rotto) è `none`: l'app si apre normalmente senza fare nulla.
 */
export type DeepLink = "ping" | "mood" | "us" | "home" | "pet" | "none";

const RE = /^fragolina:\/\/\/?([a-z]+)\/?(?:[?#].*)?$/i;

export function parseDeepLink(url: string | null | undefined): DeepLink {
  if (!url) return "none";
  const m = RE.exec(url.trim());
  if (!m) return "none";
  const k = m[1].toLowerCase();
  return k === "ping" || k === "mood" || k === "us" || k === "home" || k === "pet" ? k : "none";
}

/**
 * Percorso che Expo Router deve aprire per un link di sistema (usato da app/+native-intent.ts).
 * L'AZIONE (mandare il pensiero…) non passa di qui: la fa `useDeepLinks`, una volta sola. Qui basta evitare che
 * il router cerchi una rotta "ping" che non esiste. `null` = non è un nostro link: lascia fare al router.
 */
export function systemPathFor(url: string): string | null {
  switch (parseDeepLink(url)) {
    case "us":
      return "/us";
    case "pet":
      return "/pet";
    case "ping":
    case "mood":
    case "home":
      return "/";
    default:
      return null;
  }
}

export type LinkDeps = {
  paired: boolean;
  /** Manda il pensiero; false se non è stato possibile (non collegati). */
  sendThought: () => boolean;
  goTo: (path: "/" | "/us" | "/pet") => void;
  requestMoodSheet: () => void;
  /** Conferma visiva + aptica dopo un pensiero partito. */
  confirmPing: () => void;
};

export type LinkOutcome = "sent" | "mood" | "to-us" | "to-home" | "to-pet" | "ignored";

/** Esegue il link. Chiamarla UNA volta per link (l'idempotenza è in `createLinkGate`). */
export function runDeepLink(link: DeepLink, d: LinkDeps): LinkOutcome {
  switch (link) {
    case "ping":
      if (!d.paired) {
        d.goTo("/us");
        return "to-us";
      }
      d.goTo("/");
      if (!d.sendThought()) return "ignored";
      d.confirmPing();
      return "sent";
    case "mood":
      if (!d.paired) {
        d.goTo("/us");
        return "to-us";
      }
      d.goTo("/");
      d.requestMoodSheet();
      return "mood";
    case "us":
      d.goTo("/us");
      return "to-us";
    case "home":
      d.goTo("/");
      return "to-home";
    case "pet":
      d.goTo("/pet");
      return "to-pet";
    default:
      return "ignored";
  }
}

/**
 * Cancello di idempotenza: lo stesso link arrivato due volte in pochi secondi (evento + URL iniziale, doppio
 * callback del sistema, riavvio veloce dell'app) vale una volta sola; l'URL iniziale vale una volta per esecuzione.
 * Due tocchi veri sul widget a distanza di qualche secondo sono due pensieri.
 */
export function createLinkGate(windowMs = 4000) {
  let lastUrl = "";
  let lastAt = -Infinity;
  let initialDone = false;
  return {
    accept(url: string, now: number, initial = false): boolean {
      if (initial) {
        if (initialDone) return false;
        initialDone = true;
      }
      if (url === lastUrl && now - lastAt < windowMs) return false;
      lastUrl = url;
      lastAt = now;
      return true;
    },
  };
}
