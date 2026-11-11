import { useEffect } from "react";

import { S } from "@/lib/strings.it";
import { makeSnapshot, widgetBridge } from "@/lib/widgetBridge";
import { selectThoughtsToday, useCouple } from "@/state/coupleStore";

/**
 * Tiene il widget allineato allo store: a ogni cambio rilevante (umore, pensieri, nomi, data) scrive lo snapshot
 * (con un piccolo debounce) e all'avvio. Montare una volta nella radice.
 */
export function useWidgetSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = () => {
      const s = useCouple.getState();
      widgetBridge.push(
        makeSnapshot({
          partnerName: s.partnerName,
          moodId: s.partnerMood,
          moodLabel: S.moods[s.partnerMood],
          thinkingToday: selectThoughtsToday(s),
          startDate: s.startDate,
        }),
      );
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(push, 400);
    };
    push();
    const unsub = useCouple.subscribe(schedule);
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
