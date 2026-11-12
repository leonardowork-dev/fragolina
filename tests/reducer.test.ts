import { describe, expect, it } from "vitest";

import { MOOD_IDS } from "@/features/home/moods";
import {
  applyEvent,
  applySnapshot,
  lww,
  questionIdForDay,
  rollbackOp,
  rolloverDay,
  type SyncedState,
} from "@/lib/sync/reducer";
import type { QueuedOp, RemoteState } from "@/lib/sync/types";

const IDS = ["q1", "q2", "q3"];
const DAY = "2026-11-12";
const base = (over: Partial<SyncedState> = {}): SyncedState => ({
  userId: "me",
  coupleId: "c1",
  myRole: "a",
  joinCode: null,
  joinCodeExpiresAt: null,
  members: [
    { userId: "me", displayName: "Io", role: "a" },
    { userId: "lei", displayName: "Lei", role: "b" },
  ],
  meName: "Io",
  partnerName: "Lei",
  startDate: null,
  startDateAt: 0,
  myMood: null,
  partnerMood: null,
  pingsDay: DAY,
  pingsSentToday: 0,
  pingsReceivedTotal: 0,
  lastPingReceivedAt: null,
  lastPingSentAt: null,
  question: { day: DAY, id: "q1", myAnswer: null, partnerAnswer: null },
  ...over,
});
const snap = (over: Partial<RemoteState> = {}): RemoteState => ({
  paired: true,
  userId: "me",
  couple: {
    id: "c1",
    joinCode: null,
    joinCodeExpiresAt: null,
    startDate: "2025-02-14",
    startDateAt: 100,
  },
  members: base().members,
  myMood: null,
  partnerMood: null,
  pingsSentToday: 0,
  pingsReceivedTotal: 0,
  lastPingReceivedAt: null,
  lastPingSentAt: null,
  myAnswer: null,
  partnerAnswer: null,
  ...over,
});

describe("last-write-wins", () => {
  it("lww sceglie l'at maggiore; a parità vince il remoto (ultimo arrivato)", () => {
    expect(lww({ at: 1 }, { at: 2 })).toEqual({ at: 2 });
    expect(lww({ at: 3 }, { at: 2 })).toEqual({ at: 3 });
    expect(lww({ at: 2, x: 1 } as { at: number; x?: number }, { at: 2, x: 2 })).toEqual({
      at: 2,
      x: 2,
    });
    expect(lww(null, { at: 1 })).toEqual({ at: 1 });
    expect(lww({ at: 1 }, null)).toEqual({ at: 1 });
  });
  it("umore del partner: un evento vecchio non sovrascrive uno nuovo", () => {
    let s = applyEvent(
      base(),
      { type: "mood", userId: "lei", moodId: "felice", at: 200 },
      DAY,
      IDS,
    );
    s = applyEvent(s, { type: "mood", userId: "lei", moodId: "triste", at: 100 }, DAY, IDS);
    expect(s.partnerMood).toEqual({ moodId: "felice", at: 200 });
    s = applyEvent(s, { type: "mood", userId: "lei", moodId: "carica", at: 300 }, DAY, IDS);
    expect(s.partnerMood?.moodId).toBe("carica");
  });
  it("il mio umore locale (anche in coda) batte una fotografia più vecchia", () => {
    const s = applySnapshot(
      base({ myMood: { moodId: "stanca", at: 500 } }),
      snap({ myMood: { moodId: "felice", at: 400 } }),
      DAY,
      [],
      IDS,
    );
    expect(s.myMood?.moodId).toBe("stanca");
    const s2 = applySnapshot(
      base({ myMood: { moodId: "stanca", at: 300 } }),
      snap({ myMood: { moodId: "felice", at: 400 } }),
      DAY,
      [],
      IDS,
    );
    expect(s2.myMood?.moodId).toBe("felice");
  });
  it("data d'inizio: vince la scrittura più recente, da chiunque", () => {
    let s = base({ startDate: "2024-01-01", startDateAt: 1000 });
    s = applyEvent(
      s,
      {
        type: "couple",
        startDate: "2023-05-05",
        startDateAt: 900,
        joinCode: null,
        joinCodeExpiresAt: null,
      },
      DAY,
      IDS,
    );
    expect(s.startDate).toBe("2024-01-01");
    s = applyEvent(
      s,
      {
        type: "couple",
        startDate: "2023-05-05",
        startDateAt: 1100,
        joinCode: null,
        joinCodeExpiresAt: null,
      },
      DAY,
      IDS,
    );
    expect(s.startDate).toBe("2023-05-05");
    const snapNew = applySnapshot(
      base({ startDate: "2024-01-01", startDateAt: 5000 }),
      snap(),
      DAY,
      [],
      IDS,
    );
    expect(snapNew.startDate).toBe("2024-01-01"); // locale più nuovo del server (100)
    const snapOld = applySnapshot(
      base({ startDate: "2024-01-01", startDateAt: 50 }),
      snap(),
      DAY,
      [],
      IDS,
    );
    expect(snapOld.startDate).toBe("2025-02-14");
  });
  it("data del server null: si tiene quella locale", () => {
    const s = applySnapshot(
      base({ startDate: "2024-01-01", startDateAt: 5 }),
      snap({ couple: { ...snap().couple!, startDate: null } }),
      DAY,
      [],
      IDS,
    );
    expect(s.startDate).toBe("2024-01-01");
  });
});

describe("pensieri (append-only)", () => {
  it("un pensiero del partner incrementa il totale; un eco del mio no", () => {
    let s = applyEvent(base(), { type: "ping", id: "1", fromUserId: "lei", at: 10 }, DAY, IDS);
    expect(s.pingsReceivedTotal).toBe(1);
    s = applyEvent(s, { type: "ping", id: "2", fromUserId: "me", at: 11 }, DAY, IDS);
    expect(s.pingsReceivedTotal).toBe(1);
  });
  it("un evento già incluso nella fotografia non si conta due volte", () => {
    let s = applySnapshot(
      base(),
      snap({ pingsReceivedTotal: 5, lastPingReceivedAt: 1000 }),
      DAY,
      [],
      IDS,
    );
    s = applyEvent(s, { type: "ping", id: "x", fromUserId: "lei", at: 1000 }, DAY, IDS);
    expect(s.pingsReceivedTotal).toBe(5);
    s = applyEvent(s, { type: "ping", id: "y", fromUserId: "lei", at: 1001 }, DAY, IDS);
    expect(s.pingsReceivedTotal).toBe(6);
  });
  it("il totale non scende mai nella stessa coppia (fotografia vecchia)", () => {
    const s = applySnapshot(
      base({ pingsReceivedTotal: 10, lastPingReceivedAt: 50 }),
      snap({ pingsReceivedTotal: 8, lastPingReceivedAt: 40 }),
      DAY,
      [],
      IDS,
    );
    expect(s.pingsReceivedTotal).toBe(10);
    expect(s.lastPingReceivedAt).toBe(50);
  });
  it("i pensieri in coda di oggi si sommano al conteggio del server", () => {
    const noon = new Date(2026, 10, 12, 12).getTime();
    const q: QueuedOp[] = [
      { key: "a", kind: "ping", at: noon, attempts: 0 },
      { key: "b", kind: "ping", at: noon, attempts: 0 },
    ];
    const s = applySnapshot(base(), snap({ pingsSentToday: 4 }), DAY, q, IDS);
    expect(s.pingsSentToday).toBe(6);
  });
  it("10.000 pensieri: contatori numerici, nessun array che cresce", () => {
    let s = base();
    for (let i = 0; i < 10_000; i++)
      s = applyEvent(s, { type: "ping", id: `p${i}`, fromUserId: "lei", at: i + 1 }, DAY, IDS);
    expect(s.pingsReceivedTotal).toBe(10_000);
    expect(Object.keys(s).length).toBe(Object.keys(base()).length);
  });
});

describe("domanda del giorno", () => {
  it("la domanda è la stessa su entrambi i telefoni (dipende solo dal giorno)", () => {
    expect(questionIdForDay("2026-11-12", IDS)).toBe(questionIdForDay("2026-11-12", IDS));
    expect(
      new Set(["2026-11-12", "2026-11-13", "2026-11-14"].map((d) => questionIdForDay(d, IDS))).size,
    ).toBe(3);
  });
  it("cambio giorno: contatori e risposte ripartono", () => {
    const s = rolloverDay(
      base({
        pingsSentToday: 7,
        question: { day: DAY, id: "q1", myAnswer: "a", partnerAnswer: "b" },
      }),
      "2026-11-13",
      IDS,
    );
    expect(s.pingsSentToday).toBe(0);
    expect(s.question).toMatchObject({ day: "2026-11-13", myAnswer: null, partnerAnswer: null });
  });
  it("la risposta del partner non arriva prima della mia e non si cancella dopo", () => {
    let s = applySnapshot(base(), snap({ myAnswer: null, partnerAnswer: null }), DAY, [], IDS);
    expect(s.question.partnerAnswer).toBeNull();
    s = applySnapshot(
      s,
      snap({
        myAnswer: { questionId: "q2", answer: "a", at: 1 },
        partnerAnswer: { questionId: "q2", answer: "b", at: 2 },
      }),
      DAY,
      [],
      IDS,
    );
    expect(s.question).toMatchObject({ id: "q2", myAnswer: "a", partnerAnswer: "b" });
    s = applySnapshot(
      s,
      snap({ myAnswer: { questionId: "q2", answer: "a", at: 1 }, partnerAnswer: null }),
      DAY,
      [],
      IDS,
    );
    expect(s.question.partnerAnswer).toBe("b");
  });
  it("eventi di giorni diversi si ignorano", () => {
    const s = applyEvent(
      base(),
      { type: "answer", userId: "lei", day: "2026-11-11", questionId: "q1", answer: "a", at: 1 },
      DAY,
      IDS,
    );
    expect(s.question.partnerAnswer).toBeNull();
  });
});

describe("snapshot e membri", () => {
  it("non appartiene a nessuna coppia: azzera il legame", () => {
    const s = applySnapshot(
      base(),
      { ...snap(), paired: false, couple: null, members: [] },
      DAY,
      [],
      IDS,
    );
    expect(s.coupleId).toBeNull();
    expect(s.members).toEqual([]);
  });
  it("cambio di coppia: nessun dato della vecchia (totali, umori) resta", () => {
    const s = applySnapshot(
      base({ pingsReceivedTotal: 99, partnerMood: { moodId: "felice", at: 9 } }),
      snap({ couple: { ...snap().couple!, id: "c2" } }),
      DAY,
      [],
      IDS,
    );
    expect(s.pingsReceivedTotal).toBe(0);
    expect(s.partnerMood).toBeNull();
  });
  it("nome del partner dal server; il mio nome in coda non viene sovrascritto", () => {
    const q: QueuedOp[] = [
      { key: "n", kind: "name", at: 1, attempts: 0, name: "Nuovo", prev: "Io" },
    ];
    const s = applySnapshot(
      base({ meName: "Nuovo" }),
      snap({
        members: [
          { userId: "me", displayName: "Vecchio", role: "a" },
          { userId: "lei", displayName: "Niki", role: "b" },
        ],
      }),
      DAY,
      q,
      IDS,
    );
    expect(s.meName).toBe("Nuovo");
    expect(s.partnerName).toBe("Niki");
  });
  it("member-joined / member-left / renamed", () => {
    let s = base({ members: [base().members[0]] });
    s = applyEvent(
      s,
      { type: "member-joined", member: { userId: "lei", displayName: "Niki", role: "b" } },
      DAY,
      IDS,
    );
    expect(s.members).toHaveLength(2);
    expect(s.partnerName).toBe("Niki");
    s = applyEvent(s, { type: "member-renamed", userId: "lei", displayName: "Nikole" }, DAY, IDS);
    expect(s.partnerName).toBe("Nikole");
    s = applyEvent(s, { type: "member-left", userId: "lei" }, DAY, IDS);
    expect(s.members).toHaveLength(1);
  });
  it("tutti gli umori hanno una stringa (guardia contro nuovi id)", () => {
    expect(MOOD_IDS.length).toBe(8);
  });
});

describe("rollback", () => {
  it("ping: scende di uno, mai sotto zero", () => {
    expect(
      rollbackOp(base({ pingsSentToday: 2 }), { key: "a", kind: "ping", at: 1, attempts: 0 })
        .pingsSentToday,
    ).toBe(1);
    expect(
      rollbackOp(base({ pingsSentToday: 0 }), { key: "a", kind: "ping", at: 1, attempts: 0 })
        .pingsSentToday,
    ).toBe(0);
  });
  it("umore: torna al precedente solo se non c'è un umore più nuovo", () => {
    const op: QueuedOp = {
      key: "m",
      kind: "mood",
      at: 10,
      attempts: 0,
      moodId: "triste",
      prev: { moodId: "felice", at: 5 },
    };
    expect(rollbackOp(base({ myMood: { moodId: "triste", at: 10 } }), op).myMood).toEqual({
      moodId: "felice",
      at: 5,
    });
    expect(rollbackOp(base({ myMood: { moodId: "carica", at: 20 } }), op).myMood?.moodId).toBe(
      "carica",
    );
  });
  it("data e risposta tornano indietro", () => {
    const d: QueuedOp = {
      key: "d",
      kind: "startDate",
      at: 10,
      attempts: 0,
      startDate: "2025-01-01",
      prev: { startDate: null, at: 0 },
    };
    expect(rollbackOp(base({ startDate: "2025-01-01", startDateAt: 10 }), d).startDate).toBeNull();
    const a: QueuedOp = {
      key: "a",
      kind: "answer",
      at: 1,
      attempts: 0,
      day: DAY,
      questionId: "q1",
      answer: "a",
    };
    expect(
      rollbackOp(base({ question: { day: DAY, id: "q1", myAnswer: "a", partnerAnswer: null } }), a)
        .question.myAnswer,
    ).toBeNull();
  });
});
