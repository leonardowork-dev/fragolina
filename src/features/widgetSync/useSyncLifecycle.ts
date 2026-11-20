import * as Network from "expo-network";
import { useEffect } from "react";
import { AppState, Dimensions } from "react-native";

import { useEffectsBus, useMascot, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import { petToastText } from "@/features/pet/petToast";
import { gameRejectText, gameToastText } from "@/features/play/toasts";
import { S } from "@/lib/strings.it";
import { syncEngine, useCouple } from "@/state/coupleStore";
import { isOnline, networkCameBack, useNet } from "@/state/netStore";

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
 * Rete: quando il sistema dice che internet è TORNATA, si riconnette subito e si svuota la coda offline (senza
 * aspettare il backoff 1→30 s). Errori del modulo nativo: silenziosi (si resta col backoff di prima).
 */
export function useNetworkRecovery() {
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    const apply = (state: Network.NetworkState) => {
      const next = isOnline(state);
      const prev = useNet.getState().reachable;
      useNet.getState().setReachable(next);
      if (networkCameBack(prev, next)) syncEngine.networkBack();
    };
    try {
      void Network.getNetworkStateAsync()
        .then((st) => alive && apply(st))
        .catch(() => {});
      sub = Network.addNetworkStateListener((st) => apply(st));
    } catch {
      /* senza modulo: resta il backoff */
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
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
      if (s.petIncomingSeq !== before.petIncomingSeq && s.petIncoming) {
        // l'altra persona ha curato il pet: avviso ovunque tu sia nell'app
        toast.show(petToastText(s.petIncoming, s.members, s.partnerName, s.petServer));
        haptics.light();
      }
      if (s.noteIncomingSeq !== before.noteIncomingSeq && s.noteIncoming) {
        // un biglietto di lei con l'app aperta: avviso ovunque tu sia, e compare da solo nella scheda Disegna
        toast.show(S.draw.incoming(s.noteIncoming.byName || s.partnerName));
        haptics.success();
      }
      if (s.gameIncomingSeq !== before.gameIncomingSeq && s.gameIncoming) {
        // l'altra persona ha mosso nei giochi: avviso ovunque tu sia (la partita si aggiorna da sola nella scheda Gioca)
        toast.show(gameToastText(s.gameIncoming, s.partnerName));
        haptics.light();
      }
      if (s.gameRejectedSeq !== before.gameRejectedSeq && s.gameRejected) {
        toast.show(gameRejectText(s.gameRejected, s.partnerName));
        haptics.light();
      }
      if (s.extraIncomingSeq !== before.extraIncomingSeq && s.extraIncoming) {
        // novità della sessione 7 portate dall'altra persona: domanda, evento, foto
        const x = s.extraIncoming;
        toast.show(
          x.what === "qa-answered"
            ? S.extraToast.qaAnswered(s.partnerName)
            : x.what === "qa-ready"
              ? S.extraToast.qaReady
              : x.what === "event"
                ? S.extraToast.event(s.partnerName, x.title)
                : x.what === "memory" && x.kind === "photo"
                  ? S.extraToast.photo(s.partnerName)
                  : S.extraToast.kept(s.partnerName),
        );
        haptics.light();
      }
      if (s.pairedSeq !== before.pairedSeq) toast.show(S.toast.joined(s.partnerName));
      if (s.rejectedSeq !== before.rejectedSeq) toast.show(S.link.rejected);
    });
  }, [toast]);
}
