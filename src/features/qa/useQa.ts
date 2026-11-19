import { useMemo } from "react";

import { dayQuestion } from "@/lib/qa/legacy";
import { applyQueuedAnswers, qaTodayView, queuedTomorrow } from "@/lib/qa/sync";
import type { QaDay } from "@/lib/qa/rules";
import { romeDayKey } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { useMinuteClock } from "../common/useMinuteClock";

/** La domanda di oggi come la vede questo telefono (server + la mia risposta ancora in coda), il giorno di Roma, e il resto. */
export function useQa() {
  const server = useCouple((s) => s.qaServer);
  const queue = useCouple((s) => s.queue);
  const coupleId = useCouple((s) => s.coupleId);
  const now = useMinuteClock();
  const today = romeDayKey(now.getTime());
  return useMemo(() => {
    const day = qaTodayView(server, queue, coupleId, today, now.getTime());
    const days: QaDay[] = applyQueuedAnswers(server?.days ?? [], queue);
    const tomorrow = server?.tomorrow ?? today;
    const tomorrowDay = server?.days.find((d) => d.day === tomorrow) ?? null;
    return {
      today,
      day,
      text: dayQuestion(day),
      days,
      tomorrow,
      tomorrowTurn: server?.tomorrowTurn ?? false,
      tomorrowCustom: queuedTomorrow(queue) ?? (tomorrowDay?.custom ?? null),
      tomorrowByMe: queuedTomorrow(queue) !== null || (!!tomorrowDay?.custom && server?.tomorrowTurn === true),
      pendingAnswer: queue.some((q) => q.kind === "qaAnswer"),
    };
  }, [server, queue, coupleId, today, now]);
}
