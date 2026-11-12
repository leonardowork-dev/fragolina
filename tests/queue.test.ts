import { describe, expect, it } from "vitest";

import { MAX_QUEUED_PINGS, enqueue, flushQueue } from "@/lib/sync/queue";
import { BackendError, type QueuedOp } from "@/lib/sync/types";

const ping = (key: string, at = 1): QueuedOp => ({ key, kind: "ping", at, attempts: 0 });
const mood = (
  key: string,
  moodId: "felice" | "triste",
  at: number,
  prev = { moodId: null as null, at: 0 },
): QueuedOp => ({ key, kind: "mood", at, attempts: 0, moodId, prev });

describe("coda offline: accodamento", () => {
  it("mantiene l'ordine di arrivo", () => {
    let q: QueuedOp[] = [];
    for (const k of ["a", "b", "c"]) q = enqueue(q, ping(k));
    expect(q.map((x) => x.key)).toEqual(["a", "b", "c"]);
  });
  it("idempotenza: la stessa chiave non si accoda due volte", () => {
    let q = enqueue([], ping("a"));
    q = enqueue(q, ping("a"));
    expect(q).toHaveLength(1);
  });
  it("umore: ne resta uno solo (l'ultimo) con il prev del PRIMO", () => {
    let q = enqueue([], mood("m1", "felice", 10, { moodId: null, at: 0 }));
    q = enqueue(q, ping("p"));
    q = enqueue(q, mood("m2", "triste", 20, { moodId: "felice" as never, at: 10 }));
    const moods = q.filter((x) => x.kind === "mood");
    expect(moods).toHaveLength(1);
    expect(moods[0].key).toBe("m2");
    expect((moods[0] as Extract<QueuedOp, { kind: "mood" }>).prev).toEqual({ moodId: null, at: 0 });
    expect(q.map((x) => x.kind)).toEqual(["ping", "mood"]);
  });
  it("risposta del giorno: una sola per giorno (resta la prima)", () => {
    const ans = (key: string, answer: "a" | "b"): QueuedOp => ({
      key,
      kind: "answer",
      at: 1,
      attempts: 0,
      day: "2026-11-12",
      questionId: "q",
      answer,
    });
    let q = enqueue([], ans("x", "a"));
    q = enqueue(q, ans("y", "b"));
    expect(q).toHaveLength(1);
    expect((q[0] as Extract<QueuedOp, { kind: "answer" }>).answer).toBe("a");
  });
  it("pensieri: append-only con tetto (cadono i più vecchi)", () => {
    let q: QueuedOp[] = [];
    for (let i = 0; i < MAX_QUEUED_PINGS + 25; i++) q = enqueue(q, ping(`p${i}`, i));
    expect(q).toHaveLength(MAX_QUEUED_PINGS);
    expect(q[0].key).toBe("p25");
    expect(q.at(-1)!.key).toBe(`p${MAX_QUEUED_PINGS + 24}`);
  });
});

describe("coda offline: svuotamento", () => {
  it("esegue in ordine e restituisce tutto fatto", async () => {
    const order: string[] = [];
    const q = ["a", "b", "c"].map((k) => ping(k));
    const r = await flushQueue(q, async (op) => void order.push(op.key));
    expect(order).toEqual(["a", "b", "c"]);
    expect(r.remaining).toEqual([]);
    expect(r.stoppedBy).toBeNull();
  });
  it("si ferma al primo errore di rete senza perdere nulla e riprende da lì", async () => {
    const q = ["a", "b", "c", "d"].map((k) => ping(k));
    const sent: string[] = [];
    let down = true;
    const exec = async (op: QueuedOp) => {
      if (op.key === "c" && down) throw new BackendError("network");
      sent.push(op.key);
    };
    const r1 = await flushQueue(q, exec);
    expect(sent).toEqual(["a", "b"]);
    expect(r1.stoppedBy).toBe("network");
    expect(r1.remaining.map((x) => x.key)).toEqual(["c", "d"]);
    expect(r1.remaining[0].attempts).toBe(1);
    down = false;
    const r2 = await flushQueue(r1.remaining, exec);
    expect(sent).toEqual(["a", "b", "c", "d"]); // ordine globale rispettato, nessun doppione
    expect(r2.remaining).toEqual([]);
  });
  it("un rifiuto definitivo scarta solo quell'operazione e prosegue", async () => {
    const q = ["a", "b", "c"].map((k) => ping(k));
    const sent: string[] = [];
    const r = await flushQueue(q, async (op) => {
      if (op.key === "b") throw new BackendError("not_paired");
      sent.push(op.key);
    });
    expect(sent).toEqual(["a", "c"]);
    expect(r.rejected.map((x) => x.op.key)).toEqual(["b"]);
    expect(r.remaining).toEqual([]);
  });
  it("errori di sessione e di limite fermano la coda", async () => {
    for (const kind of ["session", "rate_limited"] as const) {
      const r = await flushQueue([ping("a"), ping("b")], async () => {
        throw new BackendError(kind);
      });
      expect(r.stoppedBy).toBe(kind);
      expect(r.remaining).toHaveLength(2);
    }
  });
});
