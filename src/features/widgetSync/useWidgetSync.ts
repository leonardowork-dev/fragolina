import { useEffect } from "react";
import { AppState } from "react-native";

import { buildSnapshot, snapshotSignature } from "@/lib/widgetPayload";
import { widgetBridge } from "@/lib/widgetBridge";
import { localDayKey } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

/**
 * Tiene il widget allineato ai dati VERI della coppia (umore di lei, pensieri, giorni, ultimo pensiero).
 * Scrive nel container condiviso e ricarica le timeline a ogni cambio, compresi quelli che arrivano dal partner in
 * tempo reale mentre l'app è aperta (debounce 400 ms). Se non cambia nulla riscrive al massimo ogni 5 minuti
 * (aggiorna "aggiornato X fa"). Quando l'app va in secondo piano scrive un'ultima volta.
 * Nessuna notifica push (serve un account a pagamento): il widget si aggiorna quando l'app gira o quando iOS decide.
 * Montare una volta nella radice.
 */
export function useWidgetSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSig = "";
    let lastAt = 0;
    const push = (force = false) => {
      const now = Date.now();
      const snap = buildSnapshot(useCouple.getState(), now, localDayKey(new Date(now)));
      const sig = snapshotSignature(snap);
      if (!force && sig === lastSig && now - lastAt < 5 * 60_000) return;
      lastSig = sig;
      lastAt = now;
      widgetBridge.push(snap);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => push(), 400);
    };
    push(true);
    const unsub = useCouple.subscribe(schedule);
    const app = AppState.addEventListener("change", (st) => {
      if (st !== "active") push(true);
    });
    return () => {
      unsub();
      app.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
