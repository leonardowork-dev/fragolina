import { useEffect } from "react";

import { useToast } from "@/design";
import { getBackend } from "@/lib/backend";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

/**
 * Fuori dalla zona il "ho voglia" arriva SOLO come un avviso neutro ("Nikole ti ha mandato una fragola"). Qui non si
 * tiene niente: si guarda se c'è un segnale nuovo e si butta via tutto il resto. Il significato lo vede solo chi apre la zona.
 */
export function useZoneNotice() {
  const toast = useToast();
  const coupleId = useCouple((s) => s.coupleId);
  const paired = useCouple((s) => s.members.length >= 2);
  const partner = useCouple((s) => s.partnerName);
  const enabled = useSettings((s) => s.zoneEnabled);
  useEffect(() => {
    if (!coupleId || !paired || !enabled) return;
    let lastAt = 0;
    let alive = true;
    const check = async (first: boolean) => {
      try {
        const snap = await getBackend().zoneGet();
        const at = snap?.signal.incoming?.at ?? 0;
        if (!alive || !snap) return;
        if (!first && at > lastAt) toast.show(S.zone.neutralFruit(partner || "…"));
        lastAt = Math.max(lastAt, at);
      } catch {
        /* silenzio */
      }
    };
    void check(true);
    let off: (() => void) | null = null;
    try {
      off = getBackend().subscribeZone(coupleId, () => void check(false));
    } catch {
      /* niente */
    }
    return () => {
      alive = false;
      off?.();
    };
  }, [coupleId, paired, partner, enabled, toast]);
}
