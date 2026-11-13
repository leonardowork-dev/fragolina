import type { MoodId } from "@/features/home/moods";
import { localDayKey } from "@/lib/time";

import type { DailyAnswer, Member, QueuedOp, RemoteEvent, RemoteState } from "./types";

/**
 * Parte dello store che arriva (o parte) dal server. Funzioni PURE: nessun accesso a rete, store o orologio.
 * Regole: umore e data d'inizio = last-write-wins (vince `at` più grande, a parità vince l'ultimo arrivato);
 * pensieri = solo aggiunta, il totale non scende mai nella stessa coppia; risposte = immutabili.
 */
export type Stamp<T> = { value: T; at: number };

export type SyncedState = {
  userId: string | null;
  coupleId: string | null;
  myRole: "a" | "b" | null;
  joinCode: string | null;
  joinCodeExpiresAt: number | null;
  members: Member[];
  meName: string;
  partnerName: string;
  startDate: string | null;
  startDateAt: number;
  myMood: { moodId: MoodId; at: number } | null;
  partnerMood: { moodId: MoodId; at: number } | null;
  pingsDay: string;
  pingsSentToday: number;
  pingsReceivedTotal: number;
  lastPingReceivedAt: number | null;
  lastPingSentAt: number | null;
  question: {
    day: string;
    id: string;
    myAnswer: DailyAnswer | null;
    partnerAnswer: DailyAnswer | null;
  };
};

export const lww = <T extends { at: number }>(local: T | null, remote: T | null): T | null => {
  if (!remote) return local;
  if (!local) return remote;
  return remote.at >= local.at ? remote : local;
};

const maxN = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.max(a, b);

export function questionIdForDay(day: string, ids: readonly string[]): string {
  // Numero stabile dal giorno (AAAA-MM-GG → giorni dal 1970): entrambi i telefoni scelgono la stessa domanda.
  const [y, m, d] = day.split("-").map(Number);
  const n = Math.floor(Date.UTC(y || 1970, (m || 1) - 1, d || 1) / 86400000);
  return ids[((n % ids.length) + ids.length) % ids.length];
}

/** Se è cambiato il giorno, il contatore di oggi e la domanda ripartono. */
export function rolloverDay(s: SyncedState, day: string, ids: readonly string[]): SyncedState {
  let next = s;
  if (s.pingsDay !== day) next = { ...next, pingsDay: day, pingsSentToday: 0 };
  if (s.question.day !== day)
    next = {
      ...next,
      question: { day, id: questionIdForDay(day, ids), myAnswer: null, partnerAnswer: null },
    };
  return next;
}

export function applySnapshot(
  s: SyncedState,
  snap: RemoteState,
  day: string,
  queue: QueuedOp[],
  questionIds: readonly string[],
): SyncedState {
  let next = rolloverDay(s, day, questionIds);
  if (!snap.paired || !snap.couple) {
    return {
      ...next,
      userId: snap.userId,
      coupleId: null,
      myRole: null,
      joinCode: null,
      joinCodeExpiresAt: null,
      members: [],
      myMood: null,
      partnerMood: null,
      pingsReceivedTotal: 0,
      lastPingReceivedAt: null,
      lastPingSentAt: null,
      pingsSentToday: 0,
      question: { ...next.question, myAnswer: null, partnerAnswer: null },
    };
  }
  const sameCouple = s.coupleId === snap.couple.id;
  const me = snap.members.find((m) => m.userId === snap.userId);
  const other = snap.members.find((m) => m.userId !== snap.userId);
  const pendingName = queue.some((q) => q.kind === "name");

  // Data d'inizio: last-write-wins fra il valore locale (anche in coda) e quello del server.
  let startDate = next.startDate;
  let startDateAt = next.startDateAt;
  if (snap.couple.startDate && (snap.couple.startDateAt >= next.startDateAt || !next.startDate)) {
    startDate = snap.couple.startDate;
    startDateAt = snap.couple.startDateAt;
  }

  const queuedPingsToday = queue.filter(
    (q) => q.kind === "ping" && localDayKey(new Date(q.at)) === day,
  ).length;
  const queuedAnswer = queue.find(
    (q): q is Extract<QueuedOp, { kind: "answer" }> => q.kind === "answer" && q.day === day,
  );

  return {
    ...next,
    userId: snap.userId,
    coupleId: snap.couple.id,
    myRole: me?.role ?? next.myRole,
    joinCode: snap.couple.joinCode,
    joinCodeExpiresAt: snap.couple.joinCodeExpiresAt,
    members: snap.members,
    meName: me && !pendingName ? me.displayName : next.meName,
    partnerName: other?.displayName ?? next.partnerName,
    startDate,
    startDateAt,
    myMood: lww(sameCouple ? next.myMood : null, snap.myMood),
    partnerMood: lww(sameCouple ? next.partnerMood : null, snap.partnerMood),
    pingsDay: day,
    pingsSentToday: snap.pingsSentToday + queuedPingsToday,
    pingsReceivedTotal: sameCouple
      ? Math.max(next.pingsReceivedTotal, snap.pingsReceivedTotal)
      : snap.pingsReceivedTotal,
    lastPingReceivedAt: sameCouple
      ? maxN(next.lastPingReceivedAt, snap.lastPingReceivedAt)
      : snap.lastPingReceivedAt,
    lastPingSentAt: sameCouple
      ? maxN(next.lastPingSentAt, snap.lastPingSentAt)
      : snap.lastPingSentAt,
    question: {
      day,
      id: snap.myAnswer?.questionId ?? next.question.id,
      myAnswer:
        snap.myAnswer?.answer ??
        queuedAnswer?.answer ??
        (sameCouple ? next.question.myAnswer : null),
      // Il server la manda solo se hai già risposto; non si cancella mai una risposta già rivelata.
      partnerAnswer:
        snap.partnerAnswer?.answer ?? (sameCouple ? next.question.partnerAnswer : null),
    },
  };
}

export function applyEvent(
  s: SyncedState,
  ev: RemoteEvent,
  day: string,
  questionIds: readonly string[],
): SyncedState {
  const base = rolloverDay(s, day, questionIds);
  switch (ev.type) {
    case "ping": {
      if (ev.fromUserId === base.userId) return base; // eco del mio stesso pensiero: già contato
      // Già incluso in una fotografia più recente? (i pensieri sono ordinati nel tempo)
      if (base.lastPingReceivedAt !== null && ev.at <= base.lastPingReceivedAt) return base;
      return {
        ...base,
        pingsReceivedTotal: base.pingsReceivedTotal + 1,
        lastPingReceivedAt: ev.at,
      };
    }
    case "mood": {
      const stamped = { moodId: ev.moodId, at: ev.at };
      return ev.userId === base.userId
        ? { ...base, myMood: lww(base.myMood, stamped) }
        : { ...base, partnerMood: lww(base.partnerMood, stamped) };
    }
    case "answer": {
      if (ev.day !== day) return base;
      return ev.userId === base.userId
        ? { ...base, question: { ...base.question, id: ev.questionId, myAnswer: ev.answer } }
        : { ...base, question: { ...base.question, partnerAnswer: ev.answer } };
    }
    case "couple": {
      let next = { ...base, joinCode: ev.joinCode, joinCodeExpiresAt: ev.joinCodeExpiresAt };
      if (ev.startDate && ev.startDateAt >= base.startDateAt)
        next = { ...next, startDate: ev.startDate, startDateAt: ev.startDateAt };
      return next;
    }
    case "member-joined": {
      const members = [
        ...base.members.filter((m) => m.userId !== ev.member.userId),
        ev.member,
      ].sort((a, b) => a.role.localeCompare(b.role));
      const isMe = ev.member.userId === base.userId;
      return { ...base, members, partnerName: isMe ? base.partnerName : ev.member.displayName };
    }
    case "member-left": {
      if (ev.userId === base.userId) return base;
      return {
        ...base,
        members: base.members.filter((m) => m.userId !== ev.userId),
        partnerMood: null,
      };
    }
    case "pet":
      return base; // lo gestisce lo store (fetta del pet), non lo stato condiviso base
    case "member-renamed": {
      const members = base.members.map((m) =>
        m.userId === ev.userId ? { ...m, displayName: ev.displayName } : m,
      );
      return ev.userId === base.userId
        ? { ...base, members, meName: ev.displayName }
        : { ...base, members, partnerName: ev.displayName };
    }
  }
}

/** Annulla l'effetto locale di un'operazione rifiutata dal server. */
export function rollbackOp(s: SyncedState, op: QueuedOp): SyncedState {
  switch (op.kind) {
    case "ping":
      return { ...s, pingsSentToday: Math.max(0, s.pingsSentToday - 1) };
    case "mood":
      // solo se nel frattempo non c'è stato un umore più nuovo
      return s.myMood && s.myMood.at === op.at
        ? { ...s, myMood: op.prev.moodId ? { moodId: op.prev.moodId, at: op.prev.at } : null }
        : s;
    case "answer":
      return s.question.day === op.day && s.question.myAnswer === op.answer
        ? { ...s, question: { ...s.question, myAnswer: null } }
        : s;
    case "startDate":
      return s.startDateAt === op.at
        ? { ...s, startDate: op.prev.startDate, startDateAt: op.prev.at }
        : s;
    case "name":
      return { ...s, meName: op.prev };
    case "pet":
    case "petName":
      return s; // il pet che si vede è "server + coda": togliere l'operazione dalla coda basta
  }
}
