import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { replayEvents } from "@/lib/countdown/sync";
import { replayMemories } from "@/lib/memories/sync";
import { tomorrowAuthorRole } from "@/lib/qa/rules";
import { qaTodayView } from "@/lib/qa/sync";
import { romeDayKey } from "@/lib/time";
import { createCoupleStore } from "@/state/createCoupleStore";

let clock = Date.UTC(2026, 10, 15, 10, 0, 0);
const memStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
function phone(transport: ReturnType<typeof memoryTransport>, uid: string, name: string) {
  const backend = new MockBackend(transport, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => clock });
  const { useCouple } = createCoupleStore({ backend, storage: memStorage(), storageName: `x-${uid}`, now: () => clock, rng: () => 0.5 });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, uid };
}
type Phone = ReturnType<typeof phone>;
const settle = async (n = 14) => {
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
const today = () => romeDayKey(clock);
const qaView = (p: Phone) => {
  const s = p.store.getState();
  return qaTodayView(s.qaServer, s.queue, s.coupleId, today(), clock);
};
const events = (p: Phone) => replayEvents(p.store.getState().eventsServer, p.store.getState().queue);
const memories = (p: Phone) => {
  const s = p.store.getState();
  return replayMemories(s.memoriesServer, s.queue, s.userId ?? "", clock);
};
const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

beforeEach(() => {
  vi.useFakeTimers();
  clock = Date.UTC(2026, 10, 15, 10, 0, 0);
});
afterEach(() => vi.useRealTimers());

describe("sessione 7 · conto alla rovescia (due telefoni)", () => {
  it("A crea un evento: subito visibile (in coda), poi sul server; B lo vede in tempo reale con l'avviso", async () => {
    const { A, B } = await paired();
    expect(A.store.getState().extraAvailable).toBe(true);
    const r = A.store.getState().saveEvent(null, { title: "  Ci   vediamo ", date: "2026-12-20", time: "18:30", icon: "heart", featured: false });
    expect(r.ok).toBe(true);
    expect(events(A)).toHaveLength(1);
    expect(events(A)[0]).toMatchObject({ title: "Ci vediamo", time: "18:30" });
    expect(A.store.getState().queue).toHaveLength(1);
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(events(B)).toHaveLength(1);
    expect(events(B)[0]!.title).toBe("Ci vediamo");
    expect(B.store.getState().extraIncoming).toMatchObject({ what: "event", title: "Ci vediamo" });
    expect(A.store.getState().extraIncomingSeq).toBe(0); // chi crea non si avvisa da solo
  });

  it("senza coppia non si crea nulla; titolo vuoto e data impossibile sono rifiutati", async () => {
    const lone = phone(memoryTransport(), "uz", "Solo");
    expect(lone.store.getState().saveEvent(null, { title: "x", date: "2026-12-20", time: null, icon: "heart", featured: false })).toEqual({ ok: false, error: "not_paired" });
    const { A } = await paired();
    expect(A.store.getState().saveEvent(null, { title: "  ", date: "2026-12-20", time: null, icon: "heart", featured: false })).toEqual({ ok: false, error: "title" });
    expect(A.store.getState().saveEvent(null, { title: "x", date: "2026-02-30", time: null, icon: "heart", featured: false })).toEqual({ ok: false, error: "date" });
  });

  it("last-write-wins fra i due; un solo evento in evidenza; cancellazione per tutti e due", async () => {
    const { A, B } = await paired();
    const a = A.store.getState().saveEvent(null, { title: "Uno", date: "2026-12-20", time: null, icon: "star", featured: true });
    const b = A.store.getState().saveEvent(null, { title: "Due", date: "2026-12-21", time: null, icon: "plane", featured: false });
    await settle();
    if (!a.ok || !b.ok) throw new Error("x");
    clock += 1000;
    B.store.getState().saveEvent(b.id, { title: "Due!", date: "2026-12-22", time: null, icon: "plane", featured: true });
    await settle();
    expect(events(A).find((e) => e.id === b.id)).toMatchObject({ title: "Due!", date: "2026-12-22", featured: true });
    expect(events(A).filter((e) => e.featured).map((e) => e.id)).toEqual([b.id]);
    A.store.getState().removeEvent(a.id);
    await settle();
    expect(events(B).map((e) => e.id)).toEqual([b.id]);
  });

  it("offline: l'evento si vede subito e parte al ritorno della rete", async () => {
    const { A, B } = await paired();
    A.backend.setOffline(true);
    await settle();
    A.store.getState().saveEvent(null, { title: "Offline", date: "2026-12-20", time: null, icon: "sun", featured: false });
    await settle(30);
    expect(events(A)).toHaveLength(1);
    expect(A.store.getState().queue.length).toBeGreaterThan(0);
    expect(events(B)).toHaveLength(0);
    A.backend.setOffline(false);
    await vi.advanceTimersByTimeAsync(60_000);
    await settle(30);
    expect(A.store.getState().queue).toHaveLength(0);
    expect(events(B)).toHaveLength(1);
  });
});

describe("sessione 7 · domanda del giorno vera (segreto)", () => {
  it("la stessa domanda per tutti e due; A risponde: B vede SOLO che ha risposto, mai il testo", async () => {
    const { A, B } = await paired();
    await settle();
    expect(qaView(A).ref).toBe(qaView(B).ref);
    expect(A.store.getState().qaAnswer("  Il mare d'inverno ").ok).toBe(true);
    expect(qaView(A).mine?.text).toBe("Il mare d'inverno");
    await settle();
    const b = qaView(B);
    expect(b.theirsAnswered).toBe(true);
    expect(b.theirs).toBeNull();
    expect(JSON.stringify(B.store.getState().qaServer)).not.toContain("mare");
    expect(B.store.getState().extraIncoming).toMatchObject({ what: "qa-answered" });
  });

  it("B risponde e vede quella di A; A la riceve in tempo reale (con l'avviso 'pronte'); una sola risposta al giorno", async () => {
    const { A, B } = await paired();
    A.store.getState().qaAnswer("Il mare");
    await settle();
    expect(B.store.getState().qaAnswer("La montagna")).toEqual({ ok: true });
    await settle();
    expect(qaView(B).theirs?.text).toBe("Il mare");
    expect(qaView(A).theirs?.text).toBe("La montagna");
    expect(A.store.getState().extraIncoming).toMatchObject({ what: "qa-ready" });
    expect(A.store.getState().qaAnswer("Cambio idea")).toEqual({ ok: false, error: "done" });
    expect(A.store.getState().qaAnswer("   ")).toEqual({ ok: false, error: "empty" });
    expect(qaView(A).mine?.text).toBe("Il mare");
  });

  it("senza collegamento niente; risposta lunga tagliata a 280", async () => {
    const lone = phone(memoryTransport(), "uz", "Solo");
    expect(lone.store.getState().qaAnswer("ciao")).toEqual({ ok: false, error: "not_paired" });
    const { A } = await paired();
    A.store.getState().qaAnswer("x".repeat(400));
    expect(qaView(A).mine?.text).toHaveLength(280);
  });

  it("domani: scrive solo chi è di turno; l'altro riceve l'errore e la domanda custom compare nel giorno dopo", async () => {
    const { A, B } = await paired();
    await settle();
    const roleOfA = A.store.getState().myRole!;
    const aTurn = tomorrowAuthorRole(today()) === roleOfA;
    const W = aTurn ? A : B;
    const N = aTurn ? B : A;
    expect(W.store.getState().qaServer?.tomorrowTurn).toBe(true);
    expect(N.store.getState().qaServer?.tomorrowTurn).toBe(false);
    expect(W.store.getState().qaTomorrow("ab")).toEqual({ ok: false, error: "short" });
    W.store.getState().qaTomorrow("Qual è la cosa più bella di questa settimana?");
    await settle();
    expect(N.store.getState().qaServer?.days.find((d) => d.ref === "custom")?.custom).toContain("cosa più bella");
    // chi non è di turno: il server rifiuta (la coda lo toglie)
    N.store.getState().qaTomorrow("Io non dovrei poter scrivere");
    await settle();
    expect(N.store.getState().queue).toHaveLength(0);
    expect(W.store.getState().qaServer?.days.find((d) => d.ref === "custom")?.custom).toContain("cosa più bella");
    // il giorno dopo la domanda è quella scritta, per entrambi
    clock += 86_400_000;
    await W.store.getState().refreshExtra();
    await N.store.getState().refreshExtra();
    expect(qaView(W).custom).toContain("cosa più bella");
    expect(qaView(N).custom).toBe(qaView(W).custom);
  });
});

describe("sessione 7 · ricordi (due telefoni)", () => {
  it("A aggiunge una foto: subito visibile 'in coda', poi caricata nello Storage e registrata; B la vede e può firmare l'URL", async () => {
    const { A, B } = await paired();
    const r = A.store.getState().addPhoto({ uri: JPEG, w: 1600, h: 1200, bytes: 400_000 }, "  Roma   giugno ", "2026-06-10");
    expect(r.ok).toBe(true);
    expect(memories(A)[0]).toMatchObject({ kind: "photo", pending: true, caption: "Roma giugno", day: "2026-06-10" });
    await settle();
    expect(A.store.getState().queue).toHaveLength(0);
    expect(memories(B)).toHaveLength(1);
    const m = memories(B)[0]!;
    expect(m.path).toMatch(new RegExp(`^${A.store.getState().coupleId}/${m.id}\\.jpg$`));
    const urls = await B.store.getState().signMemoryUrls([m.path!]);
    expect(urls[m.path!]).toBe(JPEG);
    expect(B.store.getState().extraIncoming).toMatchObject({ what: "memory", kind: "photo" });
  });

  it("offline: la foto resta in coda con il file locale e parte al ritorno della rete", async () => {
    const { A, B } = await paired();
    A.backend.setOffline(true);
    await settle();
    A.store.getState().addPhoto({ uri: JPEG, w: 800, h: 600, bytes: 100_000 }, "", "2026-11-15");
    await settle(30);
    expect(memories(A)[0]).toMatchObject({ pending: true, localUri: JPEG });
    expect(memories(B)).toHaveLength(0);
    A.backend.setOffline(false);
    await vi.advanceTimersByTimeAsync(60_000);
    await settle(30);
    expect(A.store.getState().queue).toHaveLength(0);
    expect(memories(B)).toHaveLength(1);
  });

  it("solo chi l'ha aggiunta la cancella (anche dallo Storage); l'altro riceve un rifiuto e la foto resta", async () => {
    const { A, B, t } = await paired();
    A.store.getState().addPhoto({ uri: JPEG, w: 800, h: 600, bytes: 100_000 }, "x", "2026-11-15");
    await settle();
    const m = memories(A)[0]!;
    const files = () => Object.keys((t.storage.read() as unknown as { extra: { files: Record<string, string> } }).extra.files);
    expect(files()).toEqual([m.path]);
    B.store.getState().deleteMemory(m.id);
    await settle();
    expect(B.store.getState().rejectedSeq).toBeGreaterThan(0);
    expect(memories(A)).toHaveLength(1);
    expect(files()).toEqual([m.path]);
    A.store.getState().deleteMemory(m.id);
    await settle();
    expect(memories(A)).toHaveLength(0);
    expect(memories(B)).toHaveLength(0);
    expect(files()).toEqual([]);
  });

  it("tenere un biglietto nei ricordi: idempotente per id; il disegno non valido è rifiutato dal server", async () => {
    const { A, B } = await paired();
    const content = { text: "Ti penso", bg: "sky" as const };
    A.store.getState().keepMemory({ id: "00000000-0000-4000-8000-000000000001", kind: "text", source: "note", caption: "Nikole", content });
    A.store.getState().keepMemory({ id: "00000000-0000-4000-8000-000000000001", kind: "text", source: "note", caption: "Nikole", content });
    await settle();
    expect(memories(B)).toHaveLength(1);
    expect(memories(B)[0]).toMatchObject({ kind: "text", source: "note", content });
    A.store.getState().keepMemory({ id: "00000000-0000-4000-8000-000000000002", kind: "draw", source: "note", caption: "", content: { strokes: [] } });
    await settle();
    expect(memories(B)).toHaveLength(1);
  });

  it("Il nostro mese: pensieri e umori di entrambi", async () => {
    const { A, B } = await paired();
    A.store.getState().sendThought();
    A.store.getState().sendThought();
    B.store.getState().sendThought();
    A.store.getState().setMyMood("felice");
    B.store.getState().setMyMood("stanca");
    await settle();
    const raw = await A.store.getState().fetchMonth(2026, 11);
    expect(raw?.pings).toEqual({ ua: 2, ub: 1 });
    expect(raw?.moods.map((m) => `${m.u}:${m.m}`).sort()).toEqual(["ua:felice", "ub:stanca"]);
    expect((await A.store.getState().fetchMonth(2026, 10))?.pings).toEqual({});
  });
});
