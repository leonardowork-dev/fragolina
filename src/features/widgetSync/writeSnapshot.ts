import { widgetFeedBase } from "@/lib/backend";
import { replayNote } from "@/lib/note/sync";
import { replayPet } from "@/lib/pet/sync";
import { replayEvents } from "@/lib/countdown/sync";
import { dayQuestion } from "@/lib/qa/legacy";
import { qaTodayView } from "@/lib/qa/sync";
import { localDayKey, romeDayKey } from "@/lib/time";
import { widgetBridge } from "@/lib/widgetBridge";
import { buildSnapshot, snapshotSignature } from "@/lib/widgetPayload";
import { useCouple } from "@/state/coupleStore";
import { useExpiry } from "@/state/expiryStore";

/** Se non cambia nulla, si riscrive solo per aggiornare "aggiornato X fa", al massimo ogni 5 minuti. */
const HEARTBEAT_MS = 5 * 60_000;
let lastSig = "";
let lastAt = 0;

/**
 * Scrive lo snapshot v6 nel container condiviso e chiede il reload dei widget. Una funzione sola, usata da
 * `useWidgetSync` (a ogni cambio dello store) e dall'aggiornamento della posizione in background (l'app può girare
 * senza interfaccia: qui non servono hook).
 */
export function writeWidgetSnapshot(force: boolean) {
  const now = Date.now();
  const day = localDayKey(new Date(now));
  const st = useCouple.getState();
  // la domanda del giorno (giorno di Roma, uguale per tutti e due): testo, se ho risposto io, se abbiamo risposto entrambi
  const qd = qaTodayView(st.qaServer, st.queue, st.coupleId, romeDayKey(now), now);
  // il pet come lo vede questo telefono (con le cure ancora in coda): il widget mostra subito ciò che hai fatto
  const pet = replayPet(st, st.queue, { userId: st.userId, role: st.myRole }, st.pendingTouches, st.pendingTouchAt, day);
  // il biglietto come lo vede questo telefono (con invii e "Pulisci" ancora in coda): il tuo widget cambia subito
  const note = replayNote(st.noteServer, st.queue, st.meName);
  const base = widgetFeedBase();
  const snap = buildSnapshot(
    {
      ...st,
      question: { text: dayQuestion(qd), myAnswer: qd.mine, partnerAnswer: qd.theirs },
      events: replayEvents(st.eventsServer, st.queue),
      pet,
      myUserId: st.userId,
      note,
      loc: st.loc,
      appExpiresAt: useExpiry.getState().mine,
      feed: base && st.widgetToken ? { url: base.url, key: base.key, token: st.widgetToken } : null,
    },
    now,
    day,
  );
  const sig = snapshotSignature(snap);
  if (!force && sig === lastSig && now - lastAt < HEARTBEAT_MS) return;
  lastSig = sig;
  lastAt = now;
  widgetBridge.push(snap);
}
