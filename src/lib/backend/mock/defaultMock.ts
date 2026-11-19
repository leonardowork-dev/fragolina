import { tabId } from "@/lib/tabScope";

import { MockBackend, browserTransport, memoryTransport } from "./MockBackend";

export function createDefaultMock(web: boolean): MockBackend {
  if (web && typeof BroadcastChannel !== "undefined") {
    const b = new MockBackend(browserTransport(), { uid: tabId() });
    const g = globalThis as { __fragolinaMock?: unknown };
    // Per le prove automatiche e il laboratorio: window.__fragolinaMock.setOffline(true)
    g.__fragolinaMock = {
      setOffline: (v: boolean) => b.setOffline(v),
      isOffline: () => b.isOffline(),
      userId: b.userId,
      // Solo per le prove (e2e): leggere ciò che il telefono riceve e provare una mossa fuori turno.
      getGames: () => b.getGames(),
      getQa: (ref: string) => b.getQa(ref),
      getMemories: () => b.getMemories(),
      gameMove: (a: Parameters<MockBackend["gameMove"]>[0]) =>
        b.gameMove(a).then(
          (g) => ({ ok: true as const, game: g }),
          (e: { kind?: string; message?: string }) => ({ ok: false as const, kind: e.kind, error: e.message }),
        ),
    };
    return b;
  }
  return new MockBackend(memoryTransport());
}
