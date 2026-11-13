import { useEffect } from "react";
import { AppState } from "react-native";

import { replayPet } from "@/lib/pet/sync";
import { createPushScheduler } from "@/lib/pushScheduler";
import { localDayKey } from "@/lib/time";
import { widgetBridge } from "@/lib/widgetBridge";
import { buildSnapshot, snapshotSignature } from "@/lib/widgetPayload";
import { selectQuestion, useCouple } from "@/state/coupleStore";

/** Attesa di quiete prima di scrivere (iOS limita le ricariche dei widget: meglio una sola dopo una raffica). */
export const WIDGET_DEBOUNCE_MS = 1500;
/** Anche se i cambi non finiscono mai, si scrive almeno ogni tanto. */
export const WIDGET_MAX_WAIT_MS = 6000;
/** Se non cambia nulla, si riscrive solo per aggiornare "aggiornato X fa", al massimo ogni 5 minuti. */
const HEARTBEAT_MS = 5 * 60_000;

/**
 * Tiene i widget allineati ai dati VERI della coppia: umore mio e suo, pensieri (inviati e ricevuti, anche in tempo
 * reale), risposta alla domanda del giorno, data d'inizio, collegamento/scollegamento. A ogni cambio scrive lo
 * snapshot v4 (v3 + il pet) nel container condiviso e chiama reloadAllTimelines (dentro `widgetBridge.push`), raggruppando le
 * raffiche con un debounce di 1,5 s (massimo 6 s). Al ritorno in primo piano riscrive (anche se uguale: aggiorna
 * "aggiornato X fa"); quando l'app va in secondo piano scrive subito un'ultima volta.
 * Nessuna notifica push (serve un account a pagamento): il widget si aggiorna quando l'app gira o quando iOS decide.
 * Montare una volta nella radice.
 */
export function useWidgetSync() {
  useEffect(() => {
    let lastSig = "";
    let lastAt = 0;
    const write = (force: boolean) => {
      const now = Date.now();
      const day = localDayKey(new Date(now));
      const st = useCouple.getState();
      const q = selectQuestion(st, day);
      // il pet come lo vede questo telefono (con le cure ancora in coda): il widget mostra subito ciò che hai fatto
      const pet = replayPet(st, st.queue, { userId: st.userId, role: st.myRole }, st.pendingTouches, st.pendingTouchAt, day);
      const snap = buildSnapshot(
        {
          ...st,
          question: { text: q.text, myAnswer: q.myAnswer, partnerAnswer: q.partnerAnswer },
          pet,
          myUserId: st.userId,
        },
        now,
        day,
      );
      const sig = snapshotSignature(snap);
      if (!force && sig === lastSig && now - lastAt < HEARTBEAT_MS) return;
      lastSig = sig;
      lastAt = now;
      widgetBridge.push(snap);
    };
    const sched = createPushScheduler({
      debounceMs: WIDGET_DEBOUNCE_MS,
      maxWaitMs: WIDGET_MAX_WAIT_MS,
      run: write,
    });
    write(true);
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
