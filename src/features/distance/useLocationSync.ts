import { useEffect } from "react";
import { AppState } from "react-native";

import { useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

import { currentRounded, getPerm, startBackground, stopBackground } from "./locationApi";

/** Ogni quanto si rinfresca la mia posizione con l'app aperta, e dopo quanto la si rimanda anche se uguale. */
const REFRESH_MS = 10 * 60_000;
const RESEND_MS = 30 * 60_000;

/**
 * Tiene fresca la MIA posizione (solo se "Condividi la distanza" è acceso e il permesso c'è): all'apertura, a ogni
 * ritorno in primo piano e ogni 10 minuti con l'app aperta; si manda solo se è cambiata o ha più di 30 minuti.
 * Con "Sempre" acceso avvia anche l'aggiornamento ad app chiusa. Montare una volta nella radice.
 */
export function useLocationSync() {
  const sharing = useCouple((s) => s.loc.sharing);
  const coupled = useCouple((s) => !!s.coupleId);
  const always = useSettings((s) => s.locationAlways);

  useEffect(() => {
    if (!sharing || !coupled) {
      void stopBackground();
      return;
    }
    let alive = true;
    const run = async () => {
      const perm = await getPerm();
      if (!alive || (perm !== "when" && perm !== "always")) return;
      const p = await currentRounded();
      if (!alive || !p) return;
      const me = useCouple.getState().loc.me;
      if (me && me.latE2 === p.latE2 && me.lonE2 === p.lonE2 && Date.now() - me.at < RESEND_MS) return;
      await useCouple.getState().shareLocation(p);
    };
    void run();
    const t = setInterval(() => void run(), REFRESH_MS);
    const sub = AppState.addEventListener("change", (st) => st === "active" && void run());
    void (async () => {
      if (always && (await getPerm()) === "always") await startBackground();
      else await stopBackground();
    })();
    return () => {
      alive = false;
      clearInterval(t);
      sub.remove();
    };
  }, [sharing, coupled, always]);
}
