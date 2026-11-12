import { useEffect } from "react";
import { AppState, Dimensions } from "react-native";

import { useEffectsBus, useMascot, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { syncEngine, useCouple } from "@/state/coupleStore";

/** Avvia il motore di sincronizzazione (quando lo store è pronto) e lo segue nei cambi primo piano / secondo piano. */
export function useSyncLifecycle() {
  const hydrated = useCouple((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    syncEngine.start();
    const sub = AppState.addEventListener("change", (st) =>
      syncEngine.setForeground(st === "active"),
    );
    return () => {
      sub.remove();
      syncEngine.stop();
    };
  }, [hydrated]);
}

/**
 * Reazioni in tempo reale visibili ovunque: un pensiero in arrivo (avviso + cuori + mascotte + aptica),
 * l'altra persona che entra, un invio annullato dal server.
 */
export function useRealtimeEffects() {
  const toast = useToast();
  useEffect(() => {
    let prev = useCouple.getState();
    return useCouple.subscribe((s) => {
      const before = prev;
      prev = s;
      if (s.incomingSeq !== before.incomingSeq) {
        toast.show(S.toast.thoughtIn(s.partnerName));
        const { width, height } = Dimensions.get("window");
        useEffectsBus.getState().fireHearts(width / 2, height * 0.4);
        useMascot.getState().react("love");
        haptics.success();
      }
      if (s.pairedSeq !== before.pairedSeq) toast.show(S.toast.joined(s.partnerName));
      if (s.rejectedSeq !== before.rejectedSeq) toast.show(S.link.rejected);
    });
  }, [toast]);
}
