import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { buildDraw, noteState } from "@/lib/note/rules";
import { replayNote } from "@/lib/note/sync";
import { createCoupleStore } from "@/state/createCoupleStore";

let clock = Date.UTC(2026, 10, 14, 10, 0, 0);
const memStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
function phone(transport: ReturnType<typeof memoryTransport>, uid: string, name: string) {
  const backend = new MockBackend(transport, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => clock });
  const { useCouple, engine } = createCoupleStore({ backend, storage: memStorage(), storageName: `n-${uid}`, now: () => clock, rng: () => 0.5 });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, engine, uid };
}
type Phone = ReturnType<typeof phone>;
const settle = async (n = 10) => {
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
const shown = (p: Phone) => {
  const s = p.store.getState();
  return replayNote(s.noteServer, s.queue, s.meName);
};
const text = { text: "Ti penso", bg: "butter" as const };

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.UTC(2026, 10, 14, 10, 0, 0);
});
afterEach(() => vi.useRealTimers());

describe("biglietto: invio, arrivo, pulizia, scadenza", () => {
  it("la lavagna è disponibile e vuota all'inizio", async () => {
    const { A } = await paired();
    expect(A.store.getState().noteAvailable).toBe(true);
    expect(shown(A)).toBeNull();
  });
  it("A manda una scritta: subito visibile (in coda), poi confermata dal server con la scadenza a +1 h", async () => {
    const { A } = await paired();
    expect(A.store.getState().sendNote("text", text)).toEqual({ ok: true });
    expect(shown(A)).toMatchObject({ by: "me", pending: true, content: text });
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(shown(A)).toMatchObject({ by: "me" });
    expect(shown(A)!.pending).toBeUndefined();
    expect(shown(A)!.expiresAt - shown(A)!.createdAt).toBe(3_600_000);
  });
  it("B lo riceve in tempo reale come 'partner', con avviso", async () => {
    const { A, B } = await paired();
    A.store.getState().sendNote("text", text);
    await settle();
    expect(shown(B)).toMatchObject({ by: "partner", byName: "Leonardo", content: text });
    expect(B.store.getState().noteIncomingSeq).toBe(1);
    expect(B.store.getState().noteIncoming).toMatchObject({ byName: "Leonardo", kind: "text" });
    expect(A.store.getState().noteIncomingSeq).toBe(0); // il proprio invio non avvisa
  });
  it("B pulisce → sparisce anche su A (uno solo dei due basta)", async () => {
    const { A, B } = await paired();
    A.store.getState().sendNote("text", text);
    await settle();
    B.store.getState().clearNote();
    expect(noteState(shown(B)!, clock)).toBe("cleared"); // subito, sul proprio telefono
    await settle();
    expect(noteState(shown(A)!, clock)).toBe("cleared");
  });
  it("scade dopo un'ora: lo stato diventa 'expired' con l'orologio, senza rete", async () => {
    const { A } = await paired();
    A.store.getState().sendNote("text", text);
    await settle();
    expect(noteState(shown(A)!, clock + 3_599_000)).toBe("active");
    expect(noteState(shown(A)!, clock + 3_600_000)).toBe("expired");
  });
  it("un biglietto nuovo sostituisce il vecchio", async () => {
    const { A, B } = await paired();
    A.store.getState().sendNote("text", text);
    await settle();
    clock += 1000;
    B.store.getState().sendNote("text", { text: "Anch'io", bg: "sky" });
    await settle();
    expect(shown(A)).toMatchObject({ by: "partner", content: { text: "Anch'io" } });
    expect(shown(B)).toMatchObject({ by: "me", content: { text: "Anch'io" } });
  });
  it("offline: resta in coda con stato 'in coda', parte da solo quando torna la rete (una volta sola)", async () => {
    const { A, B } = await paired();
    A.backend.setOffline(true);
    A.store.getState().sendNote("text", text);
    await settle();
    expect(shown(A)).toMatchObject({ pending: true });
    expect(A.store.getState().queue).toHaveLength(1);
    expect(shown(B)).toBeNull();
    A.backend.setOffline(false);
    await A.engine.flush();
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(shown(B)).toMatchObject({ content: text });
    await A.engine.flush();
    await settle();
    expect((A.backend as unknown as { server: { getBoard: (u: string) => { board: { note: unknown } } } }).server.getBoard("ua").board.note).toBeTruthy();
  });
  it("tre invii offline: in coda ne resta uno (l'ultimo)", async () => {
    const { A } = await paired();
    A.backend.setOffline(true);
    for (const t of ["uno", "due", "tre"]) A.store.getState().sendNote("text", { text: t, bg: "sky" });
    expect(A.store.getState().queue.filter((q) => q.kind === "note")).toHaveLength(1);
    expect(shown(A)).toMatchObject({ content: { text: "tre" } });
  });
  it("un disegno troppo grande viene rifiutato dal server: sparisce dalla coda e l'app avvisa", async () => {
    const { A } = await paired();
    const bad = { strokes: [{ c: "ink" as const, w: 1 as const, p: [[2000, 1]] as [number, number][] }] };
    const before = A.store.getState().rejectedSeq;
    A.store.getState().sendNote("draw", bad);
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(A.store.getState().rejectedSeq).toBe(before + 1);
    expect(shown(A)).toBeNull();
  });
  it("non collegati: sendNote dice not_paired", () => {
    const t = memoryTransport();
    const A = phone(t, "ux", "Solo");
    expect(A.store.getState().sendNote("text", text)).toEqual({ ok: false, error: "not_paired" });
  });
  it("da soli in coppia (l'altro non c'è ancora) il biglietto si manda e si vede 'da te'", async () => {
    const t = memoryTransport();
    const A = phone(t, "ua", "Leonardo");
    await A.store.getState().createCouple();
    await settle();
    A.store.getState().sendNote("text", text);
    await settle();
    expect(shown(A)).toMatchObject({ by: "me" });
  });
  it("buildDraw produce un contenuto che il server accetta", async () => {
    const { A } = await paired();
    const pts: [number, number][] = Array.from({ length: 300 }, (_, i) => [i, 100 + Math.sin(i / 10) * 40]);
    A.store.getState().sendNote("draw", buildDraw([{ points: pts, color: "leaf", thick: true }], 340));
    await settle();
    expect(shown(A)).toMatchObject({ kind: "draw" });
    expect(shown(A)!.pending).toBeUndefined();
  });
  it("il token del widget si crea una volta e si cancella quando si esce dalla coppia", async () => {
    const { A } = await paired();
    expect(A.store.getState().widgetToken).toMatch(/^[0-9a-f]{64}$/);
    await A.store.getState().leaveCouple();
    expect(A.store.getState().widgetToken).toBeNull();
    expect(A.store.getState().noteServer).toBeNull();
  });
});

describe("distanza: consenso reciproco", () => {
  it("parte spenta: nessuna posizione; A accende e manda, B (spento) non vede nulla", async () => {
    const { A, B } = await paired();
    expect(A.store.getState().loc.sharing).toBe(false);
    expect((await A.store.getState().setLocationSharing(true)).ok).toBe(true);
    expect((await A.store.getState().shareLocation({ latE2: 4190, lonE2: 1250 })).ok).toBe(true);
    await settle();
    await B.engine.resync();
    expect(B.store.getState().loc.partner).toMatchObject({ state: "mine_off", latE2: null });
  });
  it("se accendono tutti e due, ognuno vede quella dell'altro; se uno spegne, l'altro vede 'hidden' e il server dimentica", async () => {
    const { A, B } = await paired();
    await A.store.getState().setLocationSharing(true);
    await A.store.getState().shareLocation({ latE2: 4190, lonE2: 1250 });
    await B.store.getState().setLocationSharing(true);
    await B.store.getState().shareLocation({ latE2: 4546, lonE2: 919 });
    await settle();
    await A.engine.resync();
    expect(A.store.getState().loc.partner).toMatchObject({ state: "ok", latE2: 4546, lonE2: 919 });
    await B.store.getState().setLocationSharing(false);
    await settle();
    await A.engine.resync();
    expect(A.store.getState().loc.partner).toMatchObject({ state: "hidden", latE2: null });
    expect(B.store.getState().loc.me).toBeNull();
  });
  it("senza consenso la posizione non parte (not_sharing)", async () => {
    const { A } = await paired();
    const r = await A.store.getState().shareLocation({ latE2: 1, lonE2: 1 });
    expect(r).toEqual({ ok: false, error: "not_sharing" });
  });
  it("fuori scala rifiutata", async () => {
    const { A } = await paired();
    await A.store.getState().setLocationSharing(true);
    expect(await A.store.getState().shareLocation({ latE2: 9999, lonE2: 0 })).toEqual({ ok: false, error: "invalid_location" });
  });
});
