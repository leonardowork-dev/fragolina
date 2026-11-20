import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { linkBadgeText } from "@/lib/linkBadge";
import { MockBackend, memoryTransport } from "@/lib/backend/mock/MockBackend";
import { formatVersionLabel } from "@/lib/versionLabel";
import { countdownView, wallClock } from "@/lib/countdown/rules";
import { buildDraw, drawToRaw, type NoteDraw } from "@/lib/note/rules";
import { daysSince, localDayKey, romeDayKey, timeAgo } from "@/lib/time";
import { migrateCelebrated, useCelebrated } from "@/state/celebratedStore";
import { createCoupleStore } from "@/state/createCoupleStore";
import { COUPLE_VERSION, migrateCouple } from "@/state/migrateCouple";
import { migrateDraft, useDrawDraft } from "@/state/drawDraftStore";
import { isOnline, networkCameBack, SERVER_DOWN_AFTER, useNet } from "@/state/netStore";
import { migrateSettings, SETTINGS_VERSION, useSettings } from "@/state/settingsStore";

const realTZ = process.env.TZ;
afterEach(() => {
  if (realTZ === undefined) delete process.env.TZ;
  else process.env.TZ = realTZ;
});

describe("orologio e fusi", () => {
  const ROME_DST_START = Date.UTC(2026, 2, 29, 1, 0); // 02:00 → 03:00 a Roma
  const ROME_DST_END = Date.UTC(2026, 9, 25, 1, 0); // 03:00 → 02:00 a Roma

  it("il giorno di Roma (domanda del giorno) è lo stesso qualunque sia il fuso del telefono", () => {
    const instants = [ROME_DST_START - 1, ROME_DST_START, ROME_DST_END - 1, ROME_DST_END, Date.UTC(2026, 11, 31, 23, 30)];
    const seen = new Set<string>();
    for (const tz of ["Europe/Rome", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata", "UTC"]) {
      process.env.TZ = tz;
      seen.add(tz + "|" + instants.map((t) => romeDayKey(t)).join(","));
    }
    const perTz = [...seen].map((s) => s.split("|")[1]);
    expect(new Set(perTz).size).toBe(1);
  });

  it("ai confini dell'ora legale la domanda cambia a mezzanotte di Roma (non a mezzanotte UTC)", () => {
    // 28/03/2026 22:59 UTC = 23:59 Roma (ora solare) → ancora 28; 23:00 UTC = 00:00 Roma → 29
    expect(romeDayKey(Date.UTC(2026, 2, 28, 22, 59))).toBe("2026-03-28");
    expect(romeDayKey(Date.UTC(2026, 2, 28, 23, 0))).toBe("2026-03-29");
    // 24/10/2026 21:59 UTC = 23:59 Roma (ora legale, +2) → 24; 22:00 UTC = 00:00 Roma → 25
    expect(romeDayKey(Date.UTC(2026, 9, 24, 21, 59))).toBe("2026-10-24");
    expect(romeDayKey(Date.UTC(2026, 9, 24, 22, 0))).toBe("2026-10-25");
  });

  it("giorni insieme: avanza di 1 al giorno anche nel giorno da 23 e da 25 ore, in ogni fuso", () => {
    for (const tz of ["Europe/Rome", "America/New_York", "Pacific/Auckland", "UTC"]) {
      process.env.TZ = tz;
      const start = "2026-03-01";
      let prev = daysSince(start, new Date(2026, 2, 27, 12, 0));
      for (let d = 28; d <= 31; d++) {
        const n = daysSince(start, new Date(2026, 2, d, 12, 0));
        expect(n, `${tz} ${d}/3`).toBe(prev + 1);
        prev = n;
      }
      const o = daysSince("2026-10-01", new Date(2026, 9, 26, 12, 0));
      expect(o, tz).toBe(daysSince("2026-10-01", new Date(2026, 9, 25, 12, 0)) + 1);
      // il giorno locale cambia sempre a mezzanotte locale, anche a cavallo del cambio d'ora
      expect(localDayKey(new Date(2026, 2, 29, 0, 5))).toBe("2026-03-29");
      expect(localDayKey(new Date(2026, 2, 28, 23, 55))).toBe("2026-03-28");
    }
  });

  it("telefono con l'ora sbagliata: date estreme non rompono nulla", () => {
    for (const t of [0, 946684800000, 4102444800000, 32503680000000]) {
      expect(romeDayKey(t)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(localDayKey(new Date(t))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(daysSince("2026-01-01", new Date(2001, 0, 1))).toBe(0); // inizio nel futuro = 0, mai negativo
    expect(daysSince("2026-01-01", new Date(2099, 0, 1))).toBeGreaterThan(26000);
    expect(timeAgo(Date.now() + 86_400_000)).toBeTypeOf("string"); // "nel futuro" = non esplode
    expect(() => timeAgo(NaN)).not.toThrow();
  });

  it("Manca poco usa l'orologio a muro: la notte del cambio d'ora è coerente e senza salti negativi", () => {
    process.env.TZ = "Europe/Rome";
    const ev = { date: "2026-03-29", time: "09:00" };
    let last = Infinity;
    for (const [h, m] of [
      [0, 30],
      [1, 30],
      [3, 30], // alle 02:00 gli orologi saltano alle 03:00: 02:xx non esiste
      [8, 0],
    ] as const) {
      const w = wallClock(new Date(2026, 2, 29, h, m));
      expect(w.today).toBe("2026-03-29");
      const v = countdownView(ev, w.today, w.nowMin);
      expect(["hours", "minutes", "days", "today", "now"]).toContain(v.state);
      const left = 9 * 60 - w.nowMin;
      expect(left).toBeLessThan(last); // mai a ritroso
      last = left;
    }
    // il giorno prima dell'evento è "1 giorno", anche col giorno da 23 ore
    const d = wallClock(new Date(2026, 2, 28, 12, 0));
    expect(countdownView({ date: "2026-03-29", time: null }, d.today, d.nowMin).daysUntil).toBe(1);
    process.env.TZ = "Europe/Rome";
    const e = wallClock(new Date(2026, 9, 24, 12, 0));
    expect(countdownView({ date: "2026-10-26", time: null }, e.today, e.nowMin).daysUntil).toBe(2);
  });
});

describe("store persistiti: versione e migrazione", () => {
  it("impostazioni v0 (prima dei suoni) si caricano senza perdere nulla e con i suoni accesi", async () => {
    const AS = (await import("@react-native-async-storage/async-storage")).default;
    await AS.setItem(
      "fragolina.settings.v1",
      JSON.stringify({ state: { onboardingDone: true, haptics: false, reduceMotionOverride: true, darkOverride: false, locationAlways: true }, version: 0 }),
    );
    await useSettings.persist.rehydrate();
    const s = useSettings.getState();
    expect(s.onboardingDone).toBe(true);
    expect(s.haptics).toBe(false);
    expect(s.reduceMotionOverride).toBe(true);
    expect(s.locationAlways).toBe(true);
    expect(s.sounds).toBe(true);
    expect(s.hydrated).toBe(true);
  });
  it("impostazioni: migrate è puro e ignora spazzatura", () => {
    expect(SETTINGS_VERSION).toBeGreaterThanOrEqual(1);
    expect(migrateSettings({ haptics: false }, 0)).toEqual({ haptics: false, sounds: true });
    expect(migrateSettings({ sounds: false }, 0)).toEqual({ sounds: false });
    expect(migrateSettings(null, 0)).toEqual({ sounds: true });
    expect(migrateSettings("???", 0)).toEqual({ sounds: true });
  });
  it("feste già viste: stato vecchio/rotto non crasha, il massimo è 60 chiavi, una chiave scatta una volta", () => {
    expect(migrateCelebrated({ keys: ["a", 3, "b"] })).toEqual({ keys: ["a", "b"] });
    expect(migrateCelebrated(undefined)).toEqual({ keys: [] });
    useCelebrated.setState({ hydrated: false, keys: [] });
    expect(useCelebrated.getState().firstTime("x")).toBe(false); // prima dell'idratazione: mai festa
    useCelebrated.setState({ hydrated: true });
    expect(useCelebrated.getState().firstTime("x")).toBe(true);
    expect(useCelebrated.getState().firstTime("x")).toBe(false);
    for (let i = 0; i < 100; i++) useCelebrated.getState().firstTime("k" + i);
    expect(useCelebrated.getState().keys.length).toBe(60);
  });
  it("bozza del disegno: stato vecchio/rotto si ripulisce, begin/save/clear", () => {
    expect(migrateDraft({ current: { gameId: "g", startedAt: 5, draft: null } })).toEqual({ current: { gameId: "g", startedAt: 5, draft: null } });
    expect(migrateDraft({ current: { gameId: 3 } })).toEqual({ current: null });
    expect(migrateDraft(null)).toEqual({ current: null });
    const d = useDrawDraft.getState();
    d.begin("g1", 1000);
    d.save("altra", { strokes: [] });
    expect(useDrawDraft.getState().current?.draft).toBeNull();
    const draft: NoteDraw = { strokes: [{ c: "ink", w: 1, p: [[0, 0], [500, 500]] }] };
    d.save("g1", draft);
    expect(useDrawDraft.getState().current?.draft).toEqual(draft);
    d.clear("altra");
    expect(useDrawDraft.getState().current).not.toBeNull();
    d.clear("g1");
    expect(useDrawDraft.getState().current).toBeNull();
  });
  it("una bozza del disegno torna uguale (vettori ↔ pixel ↔ vettori)", () => {
    const draft: NoteDraw = {
      strokes: [
        { c: "strawberry", w: 2, p: [[100, 100], [400, 600], [900, 200]] },
        { c: "sky", w: 1, p: [[0, 1000], [1000, 0]] },
      ],
    };
    const back = buildDraw(drawToRaw(draft, 300), 300);
    expect(back.strokes.map((s) => [s.c, s.w])).toEqual([["strawberry", 2], ["sky", 1]]);
    expect(back.strokes[0]!.p[0]).toEqual([100, 100]);
    expect(back.strokes[1]!.p).toEqual([[0, 1000], [1000, 0]]);
  });
  it("coppia: stato salvato rotto/vecchio viene ripulito (coda con voci invalide, tipi sbagliati)", () => {
    expect(COUPLE_VERSION).toBeGreaterThanOrEqual(3);
    const old = {
      meName: "Leo",
      partnerName: 42,
      queue: [{ key: "k1", kind: "ping", at: 1, attempts: 0 }, { kind: "ping" }, null, "x"],
      eventsServer: "oops",
      gamesServer: [],
      loc: [],
      startDateAt: Number.NaN,
      sessionLost: "si",
    };
    const m = migrateCouple(old, 2);
    expect(m.meName).toBe("Leo");
    expect("partnerName" in m).toBe(false);
    expect(m.queue).toEqual([{ key: "k1", kind: "ping", at: 1, attempts: 0 }]);
    expect("eventsServer" in m).toBe(false);
    expect(m.gamesServer).toEqual([]);
    expect("loc" in m).toBe(false);
    expect("startDateAt" in m).toBe(false);
    expect("sessionLost" in m).toBe(false);
    expect(migrateCouple(undefined, 1)).toEqual({});
    expect(migrateCouple("boh", 1)).toEqual({});
  });
  it("coppia: uno stato v2 (sessione 7) e uno v1 (senza fette nuove) si ricaricano dallo storage senza perdere i dati", async () => {
    const mem = new Map<string, string>();
    const storage: StateStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
    for (const version of [1, 2]) {
      mem.clear();
      mem.set(
        "t-migra",
        JSON.stringify({
          state: { meName: "Leonardo", partnerName: "Nikole", startDate: "2025-02-14", startDateAt: 10, coupleId: "c1", userId: "u1", queue: [{ key: "kk-0001", kind: "ping", at: 5, attempts: 1 }] },
          version,
        }),
      );
      const backend = new MockBackend(memoryTransport(), { uid: "u1", latencyMs: [0, 0], sleep: async () => {}, clock: () => 1 });
      const { useCouple } = createCoupleStore({ backend, storage, storageName: "t-migra", now: () => 1, rng: () => 0.5 });
      await useCouple.persist.rehydrate();
      const s = useCouple.getState();
      expect(s.meName, `v${version}`).toBe("Leonardo");
      expect(s.startDate).toBe("2025-02-14");
      expect(s.coupleId).toBe("c1");
      expect(s.queue).toHaveLength(1);
      expect(Array.isArray(s.eventsServer)).toBe(true); // fette nuove: valori iniziali
      expect(Array.isArray(s.gamesServer)).toBe(true);
      expect(s.hydrated).toBe(true);
    }
  });
});

describe("rete e server", () => {
  beforeEach(() => useNet.setState({ reachable: null, failStreak: 0, serverDown: false }));

  it("isOnline: connesso/raggiungibile, null = ci si fida di isConnected", () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isOnline({})).toBe(false);
  });
  it("networkCameBack: solo il passaggio da giù a su; il primo stato non conta", () => {
    expect(networkCameBack(false, true)).toBe(true);
    expect(networkCameBack(null, true)).toBe(false);
    expect(networkCameBack(true, true)).toBe(false);
    expect(networkCameBack(true, false)).toBe(false);
  });
  it("server in pausa: dopo tre tentativi falliti con rete presente; mai se non c'è rete; si spegne al successo", () => {
    const n = useNet.getState();
    useNet.setState({ reachable: true });
    for (let i = 0; i < SERVER_DOWN_AFTER - 1; i++) n.noteFailure();
    expect(useNet.getState().serverDown).toBe(false);
    n.noteFailure();
    expect(useNet.getState().serverDown).toBe(true);
    n.noteSuccess();
    expect(useNet.getState().serverDown).toBe(false);
    useNet.setState({ reachable: false });
    for (let i = 0; i < 6; i++) n.noteFailure();
    expect(useNet.getState().serverDown).toBe(false);
  });
  it("badge unico: cosa dice e quando tace", () => {
    const base = { link: "live", queued: 0, backendKind: "supabase", serverDown: false };
    expect(linkBadgeText(base)).toBeNull();
    expect(linkBadgeText({ ...base, link: "offline" })?.text).toMatch(/Senza rete/);
    expect(linkBadgeText({ ...base, link: "offline", queued: 2 })?.text).toMatch(/2 in attesa/);
    expect(linkBadgeText({ ...base, queued: 1 })?.text).toBe("1 in attesa");
    expect(linkBadgeText({ ...base, serverDown: true })?.text).toMatch(/server dorme/i);
    expect(linkBadgeText({ ...base, serverDown: true, backendKind: "mock" })).toMatchObject({ text: "Prova locale" });
    expect(linkBadgeText({ ...base, backendKind: "mock" })?.text).toBe("Prova locale");
    expect(linkBadgeText({ ...base, link: "connecting" })).toBeNull();
  });
});

describe("versione", () => {
  it("«Versione 1.0.0 (build 70, abc1234)» e le parti mancanti si omettono", () => {
    expect(formatVersionLabel("1.0.0", "70", "abc1234")).toBe("Versione 1.0.0 (build 70, abc1234)");
    expect(formatVersionLabel("1.0.0", "70", "")).toBe("Versione 1.0.0 (build 70)");
    expect(formatVersionLabel("1.0.0", "", "abc1234")).toBe("Versione 1.0.0 (abc1234)");
    expect(formatVersionLabel("1.0.0", null, undefined)).toBe("Versione 1.0.0");
  });
});

// ---------- coppia a due telefoni: rete che torna e conteggio dei pensieri ----------
let clock = Date.UTC(2026, 10, 20, 10, 0, 0);
const memStorage = (): StateStorage => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
function phone(transport: ReturnType<typeof memoryTransport>, uid: string, name: string) {
  const backend = new MockBackend(transport, { uid, latencyMs: [0, 0], sleep: async () => {}, clock: () => clock });
  const { useCouple, engine } = createCoupleStore({ backend, storage: memStorage(), storageName: `s8-${uid}`, now: () => clock, rng: () => 0.5 });
  useCouple.setState({ meName: name });
  return { backend, store: useCouple, engine };
}
const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(5);
};
async function paired() {
  const t = memoryTransport();
  const A = phone(t, "ua", "Leonardo");
  const B = phone(t, "ub", "Nikole");
  expect((await A.store.getState().createCouple()).ok).toBe(true);
  expect((await B.store.getState().joinCouple(A.store.getState().joinCode!)).ok).toBe(true);
  await settle();
  return { A, B };
}

describe("coda e rete (store)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clock = Date.UTC(2026, 10, 20, 10, 0, 0);
  });
  afterEach(() => vi.useRealTimers());

  it("quando la rete torna (networkBack) la coda si svuota subito, senza aspettare il backoff", async () => {
    const { A, B } = await paired();
    A.backend.setOffline(true);
    await settle();
    for (let i = 0; i < 2; i++) {
      clock += 1000;
      A.store.getState().sendThought();
    }
    await settle(10);
    // più di un tentativo fallito: il backoff è già cresciuto
    await vi.advanceTimersByTimeAsync(12_000);
    expect(A.store.getState().queue).toHaveLength(2);
    expect(A.store.getState().link).toBe("offline");
    A.backend.setOffline(false);
    A.engine.networkBack();
    await vi.advanceTimersByTimeAsync(50); // ben meno del backoff
    expect(A.store.getState().queue).toHaveLength(0);
    expect(A.store.getState().link).toBe("live");
    await B.engine.resync();
    expect(B.store.getState().pingsReceivedTotal).toBe(2);
    expect(A.store.getState().pingsSentToday).toBe(2);
  });

  it("KNOWN_ISSUES 42: una lettura che incrocia la spedizione non conta due volte il pensiero", async () => {
    const { A } = await paired();
    const coupleId = A.store.getState().coupleId!;
    // il server inserisce il pensiero e risponde solo dopo un po': nel frattempo parte una rilettura
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const orig = A.backend.sendPing.bind(A.backend);
    A.backend.sendPing = async (c: string, k: string) => {
      const r = await orig(c, k);
      await gate;
      return r;
    };
    clock += 1000;
    expect(A.store.getState().sendThought()).toBe(true);
    await settle(4);
    const during = A.engine.resync(); // lettura mentre la spedizione è a metà
    await settle(8);
    expect(A.store.getState().pingsSentToday).toBe(1); // senza il mutex qui si vedeva 2 (server + coda)
    release();
    await during;
    await A.engine.flush();
    await settle(10);
    expect(A.store.getState().queue).toHaveLength(0);
    expect(A.store.getState().pingsSentToday).toBe(1);
    expect(coupleId).toBeTruthy();
  });
});
