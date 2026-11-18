import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { QUIZ_LEN } from "@/lib/games/reducer";
import { otherOf, replayGames, whoseTurn } from "@/lib/games/sync";
import type { QuizData, TrisData } from "@/lib/games/types";
import { createCoupleStore } from "@/state/createCoupleStore";

let clock = Date.UTC(2026, 10, 15, 10, 0, 0);
const memStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
function phone(transport: ReturnType<typeof memoryTransport>, uid: string, name: string) {
  const backend = new MockBackend(transport, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => clock });
  const { useCouple, engine } = createCoupleStore({ backend, storage: memStorage(), storageName: `g-${uid}`, now: () => clock, rng: () => 0.5 });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, engine, uid };
}
type Phone = ReturnType<typeof phone>;
const settle = async (n = 12) => {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5);
};
async function paired() {
  const t = memoryTransport();
  const A = phone(t, "ua", "Leonardo");
  const B = phone(t, "ub", "Nikole");
  await A.store.getState().createCouple();
  await B.store.getState().joinCouple(A.store.getState().joinCode!);
  await settle();
  return { t, A, B };
}
const view = (p: Phone) => {
  const s = p.store.getState();
  return replayGames(s, s.queue, s.userId, otherOf(s.members, s.userId));
};
const game = (p: Phone, kind: string) => view(p).games.find((g) => g.kind === kind && g.status === "open");

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.UTC(2026, 10, 15, 10, 0, 0);
});
afterEach(() => vi.useRealTimers());

describe("giochi: store a due telefoni", () => {
  it("i giochi sono disponibili e vuoti; senza coppia non si apre nulla", async () => {
    const { A } = await paired();
    expect(A.store.getState().gamesAvailable).toBe(true);
    expect(view(A).games).toHaveLength(0);
    const lone = phone(memoryTransport(), "uz", "Solo");
    expect(lone.store.getState().startGame("tris")).toEqual({ ok: false, error: "not_paired" });
  });

  it("A apre il tris: subito visibile (in coda), poi confermato; B lo vede in tempo reale con l'avviso", async () => {
    const { A, B } = await paired();
    const r = A.store.getState().startGame("tris");
    expect(r.ok).toBe(true);
    expect(game(A, "tris")).toMatchObject({ pending: true });
    expect(A.store.getState().startGame("tris")).toEqual({ ok: false, error: "game_open" });
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(game(A, "tris")!.pending).toBeUndefined();
    expect(game(B, "tris")).toBeTruthy();
    expect(B.store.getState().gameIncoming).toMatchObject({ kind: "tris", change: { type: "started" } });
    expect(A.store.getState().gameIncomingSeq).toBe(0);
  });

  it("una partita intera di tris tra A e B: turni, tocca a te, vittoria e punteggio", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("tris");
    await settle();
    const g0 = game(A, "tris")!;
    const x = (g0.data as TrisData).x;
    const first = x === "ua" ? A : B;
    const second = first === A ? B : A;
    const play = async (p: Phone, cell: number) => {
      p.store.getState().gameMove(game(p, "tris")!.id, { type: "place", cell });
      await settle();
    };
    await play(first, 0);
    expect(whoseTurn(game(second, "tris")!, second.uid)).toBe("mine");
    expect(second.store.getState().gameIncoming).toMatchObject({ change: { type: "your-turn" } });
    await play(second, 3);
    await play(first, 1);
    await play(second, 4);
    await play(first, 2);
    const done = view(first).games.find((g) => g.kind === "tris")!;
    expect(done.status).toBe("done");
    expect((done.data as TrisData).win).toEqual([0, 1, 2]);
    expect(first.store.getState().gameScores.tris?.[first.uid]).toMatchObject({ wins: 1 });
    expect(second.store.getState().gameScores.tris?.[first.uid]).toMatchObject({ wins: 1 });
    expect(second.store.getState().gameIncoming).toMatchObject({ change: { type: "done" } });
  });

  it("mossa fatta offline: parte quando torna la rete", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("tris");
    await settle();
    const x = (game(A, "tris")!.data as TrisData).x;
    const first = x === "ua" ? A : B;
    first.backend.setOffline(true);
    first.store.getState().gameMove(game(first, "tris")!.id, { type: "place", cell: 4 });
    await settle(30);
    expect((game(first, "tris")!.data as TrisData).board[4]).not.toBe("-"); // si vede subito
    expect(game(first, "tris")!.pending).toBe(true);
    expect(first.store.getState().queue).toHaveLength(1);
    first.backend.setOffline(false);
    await first.engine.flush();
    await settle(30);
    expect(first.store.getState().queue).toHaveLength(0);
    const other = first === A ? B : A;
    expect((game(other, "tris")!.data as TrisData).board[4]).not.toBe("-");
  });

  it("conflitto: la mossa fatta offline su una partita abbandonata nel frattempo torna indietro con un messaggio gentile", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("tris");
    await settle();
    const x = (game(A, "tris")!.data as TrisData).x;
    const first = x === "ua" ? A : B;
    const other = first === A ? B : A;
    const id = game(first, "tris")!.id;
    first.backend.setOffline(true);
    first.store.getState().gameMove(id, { type: "place", cell: 0 });
    other.store.getState().abandonGame(id);
    await settle(20);
    first.backend.setOffline(false);
    await first.engine.flush();
    await settle(30);
    const s = first.store.getState();
    expect(s.queue).toHaveLength(0);
    expect(s.gameRejectedSeq).toBe(1);
    expect(s.gameRejected).toMatchObject({ kind: "tris", error: "game_over" });
    expect(s.rejectedSeq).toBe(0); // niente messaggio generico
    expect(view(first).games.find((g) => g.id === id)!.status).toBe("abandoned");
  });

  it("quiz: la risposta di A non è leggibile da B finché B non risponde; poi le carte si rivelano", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("quiz");
    await settle();
    const q = game(A, "quiz")!;
    const d = q.data as QuizData;
    expect(d.qids).toHaveLength(QUIZ_LEN);
    // la domanda 0 la risponde "su di sé" subjects[0]
    const subj = d.subjects[0] === "ua" ? A : B;
    const guesser = subj === A ? B : A;
    subj.store.getState().gameMove(q.id, { type: "answer", q: 0, idx: 2 });
    await settle();
    // chi indovina vede SOLO che l'altro ha risposto
    const gv = game(guesser, "quiz")!.data as QuizData;
    expect(gv.answered[0].s).toBe(true);
    expect(gv.reveals[0]).toBeNull();
    expect(JSON.stringify(guesser.store.getState())).not.toContain('"idx":2');
    expect(guesser.store.getState().gameMine[q.id]?.qs?.["0"]).toBeUndefined();
    expect(guesser.store.getState().gameIncoming).toMatchObject({ change: { type: "answered" } });
    // chi ha risposto rivede la propria
    expect(subj.store.getState().gameMine[q.id]?.qs?.["0"]?.s).toBe(2);
    guesser.store.getState().gameMove(q.id, { type: "answer", q: 0, idx: 2 });
    await settle(20);
    const rv = (game(subj, "quiz")!.data as QuizData).reveals[0];
    expect(rv).toEqual({ s: 2, g: 2, ok: true });
    expect(subj.store.getState().gameIncoming).toMatchObject({ change: { type: "reveal" } });
  });

  it("disegna: la parola resta a chi disegna; chi indovina la vede solo alla fine", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("draw");
    await settle();
    const g = game(A, "draw")!;
    const word = A.store.getState().gameMine[g.id]?.word;
    expect(typeof word).toBe("string");
    expect(B.store.getState().gameMine[g.id]?.word).toBeUndefined();
    expect(JSON.stringify(game(B, "draw")!.data)).not.toContain(word!);
    A.store.getState().gameMove(g.id, { type: "drawing", content: { strokes: [{ c: "ink", w: 1, p: [[10, 10], [200, 200]] }] } });
    await settle();
    expect(whoseTurn(game(B, "draw")!, "ub")).toBe("mine");
    B.store.getState().gameMove(g.id, { type: "guess", text: word! });
    await settle(20);
    const done = view(B).games.find((x) => x.id === g.id)!;
    expect(done.status).toBe("done");
    expect(done.result).toMatchObject({ solved: true, word });
  });

  it("se eri offline e l'altra persona ha mosso, al ritorno l'avviso arriva dalla rilettura (una volta sola)", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("tris");
    await settle();
    const x = (game(A, "tris")!.data as TrisData).x;
    const first = x === "ua" ? A : B;
    const second = first === A ? B : A;
    second.backend.setOffline(true);
    await settle(30);
    const before = second.store.getState().gameIncomingSeq;
    first.store.getState().gameMove(game(first, "tris")!.id, { type: "place", cell: 4 });
    await settle(20);
    expect(second.store.getState().gameIncomingSeq).toBe(before); // niente evento: era offline
    second.backend.setOffline(false);
    await second.engine.resync();
    await settle(20);
    expect(second.store.getState().gameIncomingSeq).toBe(before + 1);
    expect(second.store.getState().gameIncoming).toMatchObject({ change: { type: "your-turn" } });
    await second.engine.resync();
    expect(second.store.getState().gameIncomingSeq).toBe(before + 1); // già dato: non si ripete
  });
  it("mosse in coda mentre se ne sta spedendo un'altra partono tutte, senza aspettare il sondaggio", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("quiz");
    await settle();
    const q = game(A, "quiz")!;
    const d = q.data as QuizData;
    const me = A.uid;
    const mine = d.subjects.map((s, i) => (s === me ? { i, role: "s" } : { i, role: "g" }));
    expect(mine).toHaveLength(5);
    for (const m of mine) A.store.getState().gameMove(q.id, { type: "answer", q: m.i, idx: 0 });
    await settle(40);
    expect(A.store.getState().queue).toHaveLength(0);
    const bd = game(B, "quiz")!.data as QuizData;
    expect(bd.answered.every((a, i) => a[d.subjects[i] === me ? "s" : "g"])).toBe(true);
  });
  it("abbandonare chiude per entrambi e si può ricominciare", async () => {
    const { A, B } = await paired();
    A.store.getState().startGame("tris");
    await settle();
    B.store.getState().abandonGame(game(B, "tris")!.id);
    await settle();
    expect(game(A, "tris")).toBeUndefined();
    expect(A.store.getState().gameIncoming).toMatchObject({ change: { type: "abandoned" } });
    expect(A.store.getState().startGame("tris").ok).toBe(true);
  });
});
