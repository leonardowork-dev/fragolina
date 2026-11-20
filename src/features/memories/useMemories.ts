import { useEffect, useMemo, useState } from "react";

import { replayEvents } from "@/lib/countdown/sync";
import { type TimelineMonth, buildTimeline, yearsAgoToday } from "@/lib/memories/timeline";
import { replayMemories } from "@/lib/memories/sync";
import { applyQueuedAnswers } from "@/lib/qa/sync";
import { wallClock } from "@/lib/countdown/rules";
import { useCouple } from "@/state/coupleStore";

import { useMinuteClock } from "../common/useMinuteClock";

/** L'album come lo vede questo telefono: foto e ricordi tenuti (server + coda), eventi passati, domande, traguardi. */
export function useMemories() {
  const memoriesServer = useCouple((s) => s.memoriesServer);
  const eventsServer = useCouple((s) => s.eventsServer);
  const qaServer = useCouple((s) => s.qaServer);
  const queue = useCouple((s) => s.queue);
  const userId = useCouple((s) => s.userId);
  const startDate = useCouple((s) => s.startDate);
  const now = useMinuteClock();
  return useMemo(() => {
    const { today, nowMin } = wallClock(now);
    const memories = replayMemories(memoriesServer, queue, userId ?? "", now.getTime());
    const timeline: TimelineMonth[] = buildTimeline({
      memories,
      events: replayEvents(eventsServer, queue),
      qa: applyQueuedAnswers(qaServer?.days ?? [], queue),
      startDate,
      today,
      nowMin,
    });
    return { memories, timeline, yearsAgo: yearsAgoToday(timeline, today), today, userId };
  }, [memoriesServer, eventsServer, qaServer, queue, userId, startDate, now]);
}

/** Rilegge l'album dal server, al massimo una volta ogni 15 s (anche se molte foto falliscono insieme). */
let lastAlbumRefresh = 0;
export function requestAlbumRefresh(now = Date.now()): boolean {
  if (now - lastAlbumRefresh < 15_000) return false;
  lastAlbumRefresh = now;
  void useCouple.getState().refreshExtra().catch(() => {});
  return true;
}

type Cached = { url: string; at: number };
const cache = new Map<string, Cached>();
const FRESH_MS = 8 * 60_000; // gli URL durano 10 minuti: si rifanno dopo 8

/** URL firmati (a scadenza breve) per le foto del server. Chiede solo quelli mancanti o quasi scaduti. */
export function useSignedUrls(paths: string[]): { urls: Record<string, string>; failed: boolean } {
  const sign = useCouple((s) => s.signMemoryUrls);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const key = paths.join("|");
  useEffect(() => {
    const now = Date.now();
    const need = paths.filter((p) => !cache.has(p) || now - cache.get(p)!.at > FRESH_MS);
    if (!need.length) return;
    let alive = true;
    void sign(need)
      .then((r) => {
        if (!alive) return;
        for (const [p, url] of Object.entries(r)) cache.set(p, { url, at: Date.now() });
        setFailed(false);
        setTick((t) => t + 1);
        // KNOWN_ISSUES 48: un file che il server non sa più firmare è stato cancellato dall'altra persona mentre
        // l'album era aperto: si rilegge l'elenco subito (la foto sparisce) invece di aspettare il sondaggio.
        if (need.some((p) => !r[p])) requestAlbumRefresh();
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [key, sign]); // eslint-disable-line react-hooks/exhaustive-deps -- `paths` è già nella chiave
  return useMemo(() => {
    void tick;
    const urls: Record<string, string> = {};
    for (const p of paths) {
      const c = cache.get(p);
      if (c) urls[p] = c.url;
    }
    return { urls, failed };
  }, [key, tick, failed]); // eslint-disable-line react-hooks/exhaustive-deps
}
