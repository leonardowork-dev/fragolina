import { useMemo } from "react";

import { type CountdownEvent, countdownView, pastEvents, pickCountdown, upcomingEvents, wallClock } from "@/lib/countdown/rules";
import { replayEvents } from "@/lib/countdown/sync";
import { useCouple } from "@/state/coupleStore";

import { useMinuteClock } from "../common/useMinuteClock";

/** Gli eventi come li vede questo telefono (server + coda), divisi in "prossimi" e "passati", con l'evento in primo piano. */
export function useCountdown() {
  const server = useCouple((s) => s.eventsServer);
  const queue = useCouple((s) => s.queue);
  const now = useMinuteClock();
  const { today, nowMin } = wallClock(now);
  return useMemo(() => {
    const events = replayEvents(server, queue);
    const picked = pickCountdown(events, today, nowMin);
    return {
      events,
      today,
      nowMin,
      picked,
      upcoming: upcomingEvents(events, today, nowMin),
      past: pastEvents(events, today, nowMin),
      viewOf: (e: Pick<CountdownEvent, "date" | "time">) => countdownView(e, today, nowMin),
    };
  }, [server, queue, today, nowMin]);
}
