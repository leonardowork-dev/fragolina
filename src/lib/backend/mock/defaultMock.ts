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
    };
    return b;
  }
  return new MockBackend(memoryTransport());
}
