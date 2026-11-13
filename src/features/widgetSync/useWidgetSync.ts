import { useEffect } from "react";
import { AppState } from "react-native";

import { createPushScheduler } from "@/lib/pushScheduler";
import { useCouple } from "@/state/coupleStore";

import { writeWidgetSnapshot } from "./writeSnapshot";

/** Attesa di quiete prima di scrivere (iOS limita le ricariche dei widget: meglio una sola dopo una raffica). */
export const WIDGET_DEBOUNCE_MS = 1500;
/** Anche se i cambi non finiscono mai, si scrive almeno ogni tanto. */
export const WIDGET_MAX_WAIT_MS = 6000;

/**
 * Tiene i widget allineati ai dati VERI della coppia: umore mio e suo, pensieri (inviati e ricevuti, anche in tempo
 * reale), risposta alla domanda del giorno, data d'inizio, collegamento/scollegamento. A ogni cambio scrive lo
 * snapshot v5 (v4 + biglietto, distanza e accesso del widget al feed) nel container condiviso e chiama reloadAllTimelines (dentro `widgetBridge.push`), raggruppando le
 * raffiche con un debounce di 1,5 s (massimo 6 s). Al ritorno in primo piano riscrive (anche se uguale: aggiorna
 * "aggiornato X fa"); quando l'app va in secondo piano scrive subito un'ultima volta.
 * Nessuna notifica push (serve un account a pagamento): il widget si aggiorna quando l'app gira o quando iOS decide.
 * Montare una volta nella radice.
 */
export function useWidgetSync() {
  useEffect(() => {
    const sched = createPushScheduler({
      debounceMs: WIDGET_DEBOUNCE_MS,
      maxWaitMs: WIDGET_MAX_WAIT_MS,
      run: writeWidgetSnapshot,
    });
    writeWidgetSnapshot(true);
    const unsub = useCouple.subscribe(() => sched.notify());
    const app = AppState.addEventListener("change", (st) => {
      if (st === "active") sched.notify(true);
      else sched.flushNow(true);
    });
    return () => {
      unsub();
      app.remove();
      sched.dispose();
    };
  }, []);
}
