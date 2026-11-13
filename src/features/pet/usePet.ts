import { useEffect, useMemo, useState } from "react";

import { type PetMood, type PetState, needsAt, petMood, stageOf } from "@/lib/pet/rules";
import { buildLogView, replayPet } from "@/lib/pet/sync";
import { localDayKey } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

/** Orologio che avanza da solo (bisogni e facce cambiano col tempo anche se nessuno tocca niente). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** Il pet come lo vede QUESTO telefono: server + cure in coda + tocchi non ancora inviati. */
export function usePet() {
  const petServer = useCouple((s) => s.petServer);
  const petLog = useCouple((s) => s.petLog);
  const petMyLast = useCouple((s) => s.petMyLast);
  const queue = useCouple((s) => s.queue);
  const userId = useCouple((s) => s.userId);
  const myRole = useCouple((s) => s.myRole);
  const pendingTouches = useCouple((s) => s.pendingTouches);
  const pendingTouchAt = useCouple((s) => s.pendingTouchAt);
  const now = useNow();
  const day = localDayKey(new Date(now));

  const pet: PetState = useMemo(
    () =>
      replayPet({ petServer, petLog, petMyLast }, queue, { userId, role: myRole }, pendingTouches, pendingTouchAt, day),
    [petServer, petLog, petMyLast, queue, userId, myRole, pendingTouches, pendingTouchAt, day],
  );
  const log = useMemo(
    () => buildLogView({ petServer, petLog, petMyLast }, queue, userId, 5),
    [petServer, petLog, petMyLast, queue, userId],
  );
  const mood: PetMood = petMood(pet, now, day);
  const needs = needsAt(pet, now);
  const queued = useMemo(() => queue.filter((q) => q.kind === "pet" || q.kind === "petName").length, [queue]);
  return { pet, mood, needs, stage: stageOf(pet), log, now, day, queued, hatched: pet.hatchedAt !== null };
}
