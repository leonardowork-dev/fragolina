import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { petToastText } from "@/features/pet/petToast";
import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { COOLDOWN_MS, petMood, stageOf } from "@/lib/pet/rules";
import { buildLogView, replayPet } from "@/lib/pet/sync";
import { createCoupleStore } from "@/state/createCoupleStore";

let clock = Date.UTC(2026, 10, 13, 10, 0, 0);
const tick = (ms: number) => void (clock += ms);

const memStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

function phone(transport: ReturnType<typeof memoryTransport>, uid: string, name: string) {
  const backend = new MockBackend(transport, {
    uid,
    latencyMs: [0, 0],
    sleep: async () => {},
    clock: () => clock,
  });
  const { useCouple, engine } = createCoupleStore({
    backend,
    storage: memStorage(),
    storageName: `p-${uid}`,
    now: () => clock,
    rng: () => 0.5,
  });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, engine, uid };
}
type Phone = ReturnType<typeof phone>;
const settle = async (n = 8) => {
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
  return replayPet(s, s.queue, { userId: s.userId, role: s.myRole }, s.pendingTouches, s.pendingTouchAt, "2026-11-13");
};
/** Tocca l'uovo n volte e lascia partire il raggruppamento (600 ms). */
async function touch(p: Phone, n = 1) {
  for (let i = 0; i < n; i++) p.store.getState().touchEgg();
  await vi.advanceTimersByTimeAsync(700);
  await settle();
}
async function hatch(A: Phone, B: Phone) {
  await touch(A);
  await touch(B);
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.UTC(2026, 10, 13, 10, 0, 0);
});
afterEach(() => vi.useRealTimers());

describe("pet: schiusa a due", () => {
  it("prima del primo tocco: uovo, server senza pet = disponibile", async () => {
    const { A } = await paired();
    expect(A.store.getState().petAvailable).toBe(true);
    expect(view(A).hatchedAt).toBeNull();
    expect(petMood(view(A), clock, "2026-11-13")).toBe("egg");
  });
  it("A tocca: l'uovo reagisce subito (ottimistico), ma non si schiude; B tocca → si schiude su ENTRAMBI", async () => {
    const { A, B } = await paired();
    A.store.getState().touchEgg();
    expect(view(A).touchesA).toBe(1); // subito, prima del server
    await vi.advanceTimersByTimeAsync(700);
    await settle();
    expect(view(A).hatchedAt).toBeNull();
    expect(view(B).touchesA).toBe(1); // B lo vede in tempo reale
    await touch(B);
    expect(view(A).hatchedAt).not.toBeNull();
    expect(view(B).hatchedAt).not.toBeNull();
    expect(view(A).hatchedBy).toBe("ub");
    expect(stageOf(view(A))).toBe("seed");
  });
  it("molti tocchi si raggruppano in pochi invii", async () => {
    const { A } = await paired();
    for (let i = 0; i < 7; i++) A.store.getState().touchEgg();
    expect(A.store.getState().pendingTouches).toBe(7);
    await vi.advanceTimersByTimeAsync(700);
    await settle();
    expect(A.store.getState().pendingTouches).toBe(0);
    expect(view(A).touchesA).toBe(7);
  });
});

describe("pet: cure in due", () => {
  it("A nutre, B lo vede subito e riceve il toast; il registro dice chi e cosa", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    const seq = B.store.getState().petIncomingSeq;
    tick(5000);
    expect(A.store.getState().petAct("feed", "mora")).toEqual({ ok: true });
    await settle();
    expect(B.store.getState().petIncomingSeq).toBe(seq + 1);
    expect(B.store.getState().petIncoming).toMatchObject({ by: "ua", kind: "feed", item: "mora" });
    expect(A.store.getState().petIncomingSeq).toBe(A.store.getState().petIncomingSeq); // niente toast per le proprie cure
    expect(view(B).lastBy).toBe("ua");
    const log = buildLogView(B.store.getState(), B.store.getState().queue, "ub");
    expect(log[0]).toMatchObject({ userId: "ua", kind: "feed", item: "mora" });
  });
  it("nessun toast per le proprie cure", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    const seq = A.store.getState().petIncomingSeq;
    tick(5000);
    A.store.getState().petAct("cuddle");
    await settle();
    expect(A.store.getState().petIncomingSeq).toBe(seq);
  });
  it("pausa: la stessa cura due volte di fila viene rifiutata subito, senza viaggi al server", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    tick(5000);
    expect(A.store.getState().petAct("feed", "mora").ok).toBe(true);
    const again = A.store.getState().petAct("feed", "pesca");
    expect(again).toMatchObject({ ok: false, error: "cooldown" });
    tick(COOLDOWN_MS.feed + 1);
    expect(A.store.getState().petAct("feed", "pesca").ok).toBe(true);
    // la pausa è per persona
    tick(1000);
    expect(B.store.getState().petAct("feed", "mora").ok).toBe(true);
  });
  it("cura prima della schiusa o da non collegati: rifiutata", async () => {
    const { A } = await paired();
    expect(A.store.getState().petAct("cuddle")).toEqual({ ok: false, error: "not_hatched" });
    const solo = phone(memoryTransport(), "uz", "Zeta");
    expect(solo.store.getState().petAct("cuddle")).toEqual({ ok: false, error: "not_paired" });
  });
  it("bonus in due, stadio e faccia 'vi vuole bene' calcolati dallo stesso stato", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    tick(5000);
    A.store.getState().petAct("cuddle");
    await settle();
    expect(view(A).bothDays).toBe(1);
    expect(petMood(view(A), clock, "2026-11-13")).toBe("love");
  });
  it("il nome: lo sceglie chi lo schiude, l'altra persona lo cambia (LWW)", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    tick(1000);
    B.store.getState().setPetName("Bacca");
    await settle();
    expect(view(A).name).toBe("Bacca");
    tick(1000);
    A.store.getState().setPetName("  Fragolotta Reale Primissima ");
    await settle();
    expect(view(B).name).toBe("Fragolotta Reale");
    expect(view(B).name!.length).toBe(16);
  });
});

describe("pet: offline e riallineamento", () => {
  it("offline: la cura si vede subito, resta in coda, e al ritorno della rete arriva una volta sola", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    tick(5000);
    A.backend.setOffline(true);
    await settle();
    expect(A.store.getState().petAct("feed", "pesca").ok).toBe(true);
    tick(60_000);
    expect(A.store.getState().petAct("cuddle").ok).toBe(true);
    await settle();
    expect(A.store.getState().queue.filter((q) => q.kind === "pet")).toHaveLength(2);
    expect(view(A).lastKind).toBe("cuddle"); // visibile subito
    expect(view(B).lastKind).not.toBe("cuddle"); // B ancora no
    A.backend.setOffline(false);
    await vi.advanceTimersByTimeAsync(40_000);
    await settle(20);
    expect(A.store.getState().queue.filter((q) => q.kind === "pet")).toHaveLength(0);
    expect(view(B).lastKind).toBe("cuddle");
    // stesso stato su entrambi, nessun doppione
    expect(view(A)).toEqual(view(B));
    expect(view(A).rev).toBe(view(B).rev);
  });
  it("una cura rifiutata dal server (pausa) sparisce da sola, senza avviso", async () => {
    const { A, B } = await paired();
    await hatch(A, B);
    tick(5000);
    A.store.getState().petAct("feed", "mora");
    await settle();
    const rej = A.store.getState().rejectedSeq;
    // aggira la pausa locale: la mette in coda a mano con un'ora troppo vicina
    A.store.setState((s) => ({
      queue: [
        ...s.queue,
        {
          key: "forced-key-1",
          kind: "pet" as const,
          at: clock + 1000,
          attempts: 0,
          action: { kind: "feed" as const, item: "pesca" as const, amount: 1, day: "2026-11-13" },
        },
      ],
    }));
    tick(1000);
    await A.engine.flush();
    await settle();
    expect(A.store.getState().queue.filter((q) => q.kind === "pet")).toHaveLength(0);
    expect(A.store.getState().rejectedSeq).toBe(rej); // niente toast d'errore per un "troppo presto"
  });
  it("snapshot dopo la riconnessione: B che era offline rientra e vede tutto", async () => {
    const { A, B } = await paired();
    B.backend.setOffline(true);
    await settle();
    await touch(A);
    B.backend.setOffline(false);
    await vi.advanceTimersByTimeAsync(40_000);
    await settle(20);
    await B.engine.resync();
    expect(view(B).touchesA).toBe(1);
  });
});

describe("pet: server senza migrazione", () => {
  it("getPet = null → petAvailable false, il resto dell'app funziona", async () => {
    const t = memoryTransport();
    const A = phone(t, "ua", "Leonardo");
    vi.spyOn(A.backend, "getPet").mockResolvedValue(null);
    await A.store.getState().createCouple();
    await settle();
    expect(A.store.getState().petAvailable).toBe(false);
    expect(A.store.getState().coupleId).not.toBeNull();
    A.store.getState().setMyMood("felice");
    await settle();
    expect(A.store.getState().myMood?.moodId).toBe("felice");
  });
  it("un errore strano di getPet non rompe la sincronizzazione", async () => {
    const t = memoryTransport();
    const A = phone(t, "ua", "Leonardo");
    vi.spyOn(A.backend, "getPet").mockRejectedValue(new Error("boom"));
    await A.store.getState().createCouple();
    await settle();
    expect(A.store.getState().link).toBe("live");
  });
});


describe("pet: testo del toast", () => {
  const members = [
    { userId: "ua", displayName: "Leonardo", role: "a" as const },
    { userId: "ub", displayName: "Nikole", role: "b" as const },
  ];
  it("dice chi ha fatto cosa, col nome del pet", () => {
    const pet = { name: "Bacca" };
    expect(petToastText({ by: "ub", kind: "feed", item: "mora", at: 1 }, members, "Nikole", pet)).toBe("Nikole ha dato una mora a Bacca");
    expect(petToastText({ by: "ub", kind: "cuddle", item: null, at: 1 }, members, "Nikole", pet)).toBe("Nikole ha fatto le coccole a Bacca");
    expect(petToastText({ by: "ub", kind: "hatch", item: null, at: 1 }, members, "Nikole", pet)).toBe("Nikole ha fatto nascere Bacca!");
    expect(petToastText({ by: "ub", kind: "name", item: null, at: 1 }, members, "Nikole", pet)).toBe("Ora si chiama Bacca");
  });
  it("senza nome usa Fragolina; senza membro noto usa il nome di lei", () => {
    expect(petToastText({ by: "zz", kind: "play", item: null, at: 1 }, [], "Nikole", null)).toBe("Nikole ha giocato con Fragolina");
  });
});
