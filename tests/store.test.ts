import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { BackendError } from "@/lib/sync/types";
import { createCoupleStore } from "@/state/createCoupleStore";

let clock = Date.UTC(2026, 10, 12, 10, 0, 0);
const tick = (ms: number) => void (clock += ms);

const memStorage = (): StateStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

function phone(
  transport: ReturnType<typeof memoryTransport>,
  uid: string,
  name: string,
  storage = memStorage(),
  key = uid,
) {
  const backend = new MockBackend(transport, {
    uid,
    latencyMs: [0, 0],
    sleep: async () => {},
    clock: () => clock,
  });
  const { useCouple, engine } = createCoupleStore({
    backend,
    storage,
    storageName: `t-${key}`,
    now: () => clock,
    rng: () => 0.5,
  });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, engine, storage, uid };
}
const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5);
};
async function paired() {
  const t = memoryTransport();
  const A = phone(t, "ua", "Leonardo");
  const B = phone(t, "ub", "Nikole");
  const c = await A.store.getState().createCouple();
  expect(c.ok).toBe(true);
  const code = A.store.getState().joinCode!;
  const j = await B.store.getState().joinCouple(code);
  expect(j.ok).toBe(true);
  await settle();
  return { t, A, B, code };
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.UTC(2026, 10, 12, 10, 0, 0);
});
afterEach(() => vi.useRealTimers());

describe("pairing", () => {
  it("A crea, B entra col codice: entrambi vedono due membri e i nomi", async () => {
    const { A, B } = await paired();
    expect(A.store.getState().members).toHaveLength(2);
    expect(A.store.getState().partnerName).toBe("Nikole");
    expect(B.store.getState().partnerName).toBe("Leonardo");
    expect(A.store.getState().myRole).toBe("a");
    expect(B.store.getState().myRole).toBe("b");
    expect(A.store.getState().pairedSeq).toBe(1); // festa anche lato A (B è entrato mentre A aspettava)
  });
  it("codice sbagliato, coppia piena, già collegati, codice scaduto", async () => {
    const { t, A, B, code } = await paired();
    const C = phone(t, "uc", "Intruso");
    expect(await C.store.getState().joinCouple("AAAAAA")).toEqual({
      ok: false,
      error: "invalid_code",
    });
    expect(await C.store.getState().joinCouple(code)).toEqual({ ok: false, error: "couple_full" });
    expect(await B.store.getState().joinCouple(code)).toEqual({
      ok: false,
      error: "already_paired",
    });
    expect(await A.store.getState().createCouple()).toEqual({ ok: false, error: "already_paired" });
    // scaduto
    const X = phone(t, "ux", "Xavier");
    const Y = phone(t, "uy", "Yara");
    await X.store.getState().createCouple();
    tick(25 * 3_600_000);
    expect(await Y.store.getState().joinCouple(X.store.getState().joinCode!)).toEqual({
      ok: false,
      error: "code_expired",
    });
    expect((await X.store.getState().renewCode()).ok).toBe(true);
    expect((await Y.store.getState().joinCouple(X.store.getState().joinCode!)).ok).toBe(true);
  });
  it("senza rete la creazione fallisce con 'network'", async () => {
    const t = memoryTransport();
    const A = phone(t, "ua", "Leo");
    A.backend.setOffline(true);
    const p = A.store.getState().createCouple();
    await settle();
    expect(await p).toEqual({ ok: false, error: "network" });
  });
  it("uscire dalla coppia: ripulisce lo stato; l'altra persona resta con un codice nuovo", async () => {
    const { A, B } = await paired();
    const oldCode = A.store.getState().joinCode;
    expect((await B.store.getState().leaveCouple()).ok).toBe(true);
    expect(B.store.getState().coupleId).toBeNull();
    await A.engine.resync();
    expect(A.store.getState().members).toHaveLength(1);
    expect(A.store.getState().joinCode).not.toBe(oldCode);
  });
  it("'ha cambiato telefono' libera il posto", async () => {
    const { t, A } = await paired();
    expect((await A.store.getState().releasePartner()).ok).toBe(true);
    await settle();
    expect(A.store.getState().members).toHaveLength(1);
    const B2 = phone(t, "ub2", "Nikole");
    expect((await B2.store.getState().joinCouple(A.store.getState().joinCode!)).ok).toBe(true);
  });
});

describe("sincronizzazione in tempo reale", () => {
  it("un pensiero di A arriva a B (toast + contatore) senza doppi conteggi", async () => {
    const { A, B } = await paired();
    expect(A.store.getState().sendThought()).toBe(true);
    expect(A.store.getState().pingsSentToday).toBe(1); // ottimistico, subito
    tick(1000);
    await settle(10);
    expect(B.store.getState().incomingSeq).toBe(1);
    expect(B.store.getState().pingsReceivedTotal).toBe(1);
    expect(A.store.getState().pingsSentToday).toBe(1); // l'eco non raddoppia
    await B.engine.resync();
    expect(B.store.getState().pingsReceivedTotal).toBe(1); // la fotografia non raddoppia
    expect(B.store.getState().incomingSeq).toBe(1);
  });
  it("l'umore di B arriva ad A", async () => {
    const { A, B } = await paired();
    B.store.getState().setMyMood("coccole");
    await settle(10);
    expect(A.store.getState().partnerMood?.moodId).toBe("coccole");
    expect(B.store.getState().myMood?.moodId).toBe("coccole");
  });
  it("domanda del giorno: la risposta dell'altra si vede solo dopo la propria", async () => {
    const { A, B } = await paired();
    B.store.getState().answerQuestion("b");
    await settle(10);
    expect(A.store.getState().question.partnerAnswer).toBeNull(); // il server non l'ha mandata
    A.store.getState().answerQuestion("a");
    await settle(10);
    await A.engine.resync();
    expect(A.store.getState().question.partnerAnswer).toBe("b");
    expect(B.store.getState().question.partnerAnswer).toBe("a"); // B aveva già risposto: riceve l'evento
    A.store.getState().answerQuestion("b"); // una sola risposta al giorno
    expect(A.store.getState().question.myAnswer).toBe("a");
  });
  it("data d'inizio condivisa: l'ultima modifica vince su entrambi", async () => {
    const { A, B } = await paired();
    A.store.getState().setStartDate("2024-05-01");
    await settle(10);
    expect(B.store.getState().startDate).toBe("2024-05-01");
    tick(5000);
    B.store.getState().setStartDate("2024-06-02");
    await settle(10);
    expect(A.store.getState().startDate).toBe("2024-06-02");
    expect(B.store.getState().startDate).toBe("2024-06-02");
  });
});

describe("offline e coda", () => {
  it("offline: i pensieri restano in coda, al ritorno partono in ordine una sola volta", async () => {
    const { A, B } = await paired();
    A.backend.setOffline(true);
    await settle();
    for (let i = 0; i < 3; i++) {
      tick(1000);
      expect(A.store.getState().sendThought()).toBe(true);
    }
    await settle(10);
    expect(A.store.getState().queue).toHaveLength(3);
    expect(A.store.getState().link).toBe("offline");
    expect(B.store.getState().pingsReceivedTotal).toBe(0);
    A.backend.setOffline(false);
    await vi.advanceTimersByTimeAsync(40_000); // backoff + sondaggio
    expect(A.store.getState().queue).toHaveLength(0);
    expect(A.store.getState().link).toBe("live");
    await B.engine.resync();
    expect(B.store.getState().pingsReceivedTotal).toBe(3);
    expect(A.store.getState().pingsSentToday).toBe(3);
  });
  it("idempotenza: rimandare la stessa chiave non duplica", async () => {
    const { A, B } = await paired();
    const coupleId = A.store.getState().coupleId!;
    await A.backend.sendPing(coupleId, "chiave-0001");
    await A.backend.sendPing(coupleId, "chiave-0001");
    await B.engine.resync();
    expect(B.store.getState().pingsReceivedTotal).toBe(1);
  });
  it("la coda sopravvive al riavvio dell'app e parte da sola", async () => {
    const { t, A, B } = await paired();
    A.backend.setOffline(true);
    A.store.getState().sendThought();
    await settle();
    await vi.advanceTimersByTimeAsync(10);
    expect(A.store.getState().queue).toHaveLength(1);
    A.engine.stop();
    // "riavvio": nuovo store sullo stesso archivio, la rete è tornata
    const A2 = phone(t, "ua", "Leonardo", A.storage);
    await A2.store.persist.rehydrate();
    expect(A2.store.getState().queue).toHaveLength(1);
    expect(A2.store.getState().coupleId).toBe(A.store.getState().coupleId);
    A2.engine.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(A2.store.getState().queue).toHaveLength(0);
    await B.engine.resync();
    expect(B.store.getState().pingsReceivedTotal).toBe(1);
  });
  it("rollback ottimistico: se il server rifiuta, il contatore e l'umore tornano indietro", async () => {
    const { A } = await paired();
    A.store.getState().setMyMood("felice");
    await settle(10);
    const spy = vi.spyOn(A.backend, "sendPing").mockRejectedValue(new BackendError("not_paired"));
    const spyMood = vi
      .spyOn(A.backend, "setMood")
      .mockRejectedValue(new BackendError("not_paired"));
    A.store.getState().sendThought();
    A.store.getState().setMyMood("triste");
    expect(A.store.getState().pingsSentToday).toBe(1);
    expect(A.store.getState().myMood?.moodId).toBe("triste");
    await settle(20);
    expect(A.store.getState().pingsSentToday).toBe(0);
    expect(A.store.getState().myMood?.moodId).toBe("felice");
    expect(A.store.getState().rejectedSeq).toBeGreaterThan(0);
    expect(A.store.getState().queue).toHaveLength(0);
    spy.mockRestore();
    spyMood.mockRestore();
  });
  it("sessione sostituita: la coppia viene scollegata e segnalata", async () => {
    const { t, A } = await paired();
    A.engine.stop();
    const A2 = phone(t, "ua-nuovo", "Leonardo", A.storage, "ua"); // stesso archivio, identità diversa
    await A2.store.persist.rehydrate();
    expect(A2.store.getState().coupleId).not.toBeNull();
    A2.engine.start();
    await vi.advanceTimersByTimeAsync(50);
    expect(A2.store.getState().coupleId).toBeNull();
    expect(A2.store.getState().sessionLost).toBe(true);
  });
});
