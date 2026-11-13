import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Dimensions } from "react-native";

import { useEffectsBus, useMascot, useToast } from "@/design";
import { haptics } from "@/lib/haptics";
import { createLinkGate, parseDeepLink, runDeepLink } from "@/lib/deepLink";
import { S } from "@/lib/strings.it";
import { useIntents } from "@/state/intentStore";
import { selectPairing, useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

/**
 * Esegue i link dei widget (`fragolina://ping|mood|us|home|pet`), anche con l'app chiusa o in background.
 * - Parte solo quando store e impostazioni sono pronti e l'introduzione è finita (prima si fa l'onboarding).
 * - Un tocco = un'azione: il cancello `createLinkGate` scarta lo stesso link arrivato due volte e l'URL iniziale
 *   già gestito. Ping: manda UN pensiero con la solita coda idempotente, poi cuori + mascotte + aptica `success` + avviso.
 * Montare una volta nella radice (dentro ToastProvider).
 */
/** Uno solo per esecuzione del JavaScript: l'URL iniziale e i tocchi duplicati si contano qui. */
const gate = createLinkGate();

export function useDeepLinks() {
  const router = useRouter();
  const toast = useToast();
  const coupleReady = useCouple((s) => s.hydrated);
  const settingsReady = useSettings((s) => s.hydrated);
  const onboardingDone = useSettings((s) => s.onboardingDone);
  const active = coupleReady && settingsReady && onboardingDone;

  useEffect(() => {
    if (!active) return;
    const handle = (url: string, initial: boolean) => {
      const link = parseDeepLink(url);
      if (link === "none") return;
      if (!gate.accept(url, Date.now(), initial)) return;
      const st = useCouple.getState();
      runDeepLink(link, {
        paired: selectPairing(st) === "paired",
        sendThought: () => useCouple.getState().sendThought(),
        goTo: (path) => router.navigate(path === "/" ? "/(tabs)" : path === "/pet" ? "/(tabs)/pet" : "/(tabs)/us"),
        requestMoodSheet: () => useIntents.getState().requestMoodSheet(),
        confirmPing: () => {
          const now = useCouple.getState();
          const { width, height } = Dimensions.get("window");
          useEffectsBus.getState().fireHearts(width / 2, height * 0.4);
          useMascot.getState().react("love");
          haptics.success();
          toast.show(
            now.link === "offline"
              ? S.home.thinkQueued(now.partnerName)
              : S.home.thinkSent(now.partnerName),
          );
        },
      });
    };
    void Linking.getInitialURL()
      .then((url) => url && handle(url, true))
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handle(url, false));
    return () => sub.remove();
  }, [active, router, toast]);
}
