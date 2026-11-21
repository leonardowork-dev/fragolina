import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { getGroupResolver } from "../../../modules/group-resolver";
import { writeWidgetSnapshot } from "@/features/widgetSync/writeSnapshot";
import { getBackend } from "@/lib/backend";
import { cleanExpiry } from "@/lib/expiry";
import { useCouple } from "@/state/coupleStore";
import { useExpiry } from "@/state/expiryStore";

/** Quanto spesso riscrivo la MIA scadenza sul server anche se non è cambiata (così "ultimo avviso" resta vero). */
const REPORT_EVERY_MS = 12 * 3600_000;
let lastReported = 0;
let lastSent: number | null = null;

/** Legge la scadenza dal profilo (modulo nativo). Mai lancia: sul web o senza modulo → `null`. */
export function readOwnExpiry(): number | null {
  if (Platform.OS !== "ios") return null;
  try {
    return cleanExpiry(getGroupResolver()?.expirationDate());
  } catch {
    return null;
  }
}

/**
 * Tiene aggiornata la scadenza: la legge all'avvio e a ogni ritorno in primo piano, la manda al widget (snapshot v7)
 * e, se siete collegati, al server (così l'altra persona la vede); legge anche quella dell'altra persona.
 * Tutto "al meglio": un errore di rete non rompe nulla. Montare una volta nella radice.
 */
export function useExpirySync() {
  const hydrated = useCouple((s) => s.hydrated);
  const paired = useCouple((s) => !!s.coupleId && s.members.length >= 2);

  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    const run = async () => {
      const mine = readOwnExpiry();
      const prev = useExpiry.getState().mine;
      useExpiry.getState().setMine(mine);
      if (mine !== prev) writeWidgetSnapshot(true);
      if (!paired) return;
      try {
        const backend = getBackend();
        const now = Date.now();
        if (mine !== null && (mine !== lastSent || now - lastReported > REPORT_EVERY_MS)) {
          await backend.setAppExpiry(mine);
          lastSent = mine;
          lastReported = now;
        }
        const partner = await backend.getPartnerExpiry();
        if (alive) useExpiry.getState().setPartner(partner);
      } catch {
        /* senza rete o server vecchio: si riprova al prossimo ritorno in primo piano */
      }
    };
    void run();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void run();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [hydrated, paired]);
}
