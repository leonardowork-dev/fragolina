import type { MoodId } from "@/features/home/moods";
import { isGameReject } from "@/lib/games/errors";
import type { GameKind, GameMove, GameParams, GameRow, GamesSnapshot } from "@/lib/games/types";
import type { Note, NoteContent, NoteKind } from "@/lib/note/rules";
import type { CountdownEvent, EventInput } from "@/lib/countdown/rules";
import type { MonthRaw } from "@/lib/memories/month";
import { readPhotoBytes } from "@/lib/memories/photoDevice";
import type { Memory, MemoryKind, MemorySource } from "@/lib/memories/types";
import type { QaDay, QaSnapshot } from "@/lib/qa/rules";
import type { Board } from "@/lib/note/wire";
import type { PetState } from "@/lib/pet/rules";
import type { PetSnapshot } from "@/lib/pet/sync";
import {
  BackendError,
  type BackendErrorKind,
  type DailyAnswer,
  type RemoteState,
} from "@/lib/sync/types";
import { uuid } from "@/lib/uuid";

import type { ZOp, ZSnapshot } from "@/lib/zone/types";
import type {
  Backend,
  CodeRenewed,
  CoupleCreated,
  CoupleJoined,
  PartnerExpiry,
  PetActInput,
  SubscriptionHandlers,
} from "../types";
import {
  MockServer,
  type MockState,
  type MockStorage,
  type Res,
  type ServerChange,
  emptyMockState,
} from "./server";

/**
 * Trasporto del finto server. Nel browser: localStorage + BroadcastChannel, condivisi fra le schede (due schede = due
 * telefoni). Nei test: in memoria. Ogni scheda ha la sua identità (sessionStorage) e il suo interruttore "senza rete".
 */
export type MockBus = {
  post(c: ServerChange): void;
  listen(cb: (c: ServerChange) => void): () => void;
};

export function memoryTransport(): { storage: MockStorage; bus: MockBus } {
  let state = emptyMockState();
  const subs = new Set<(c: ServerChange) => void>();
  return {
    storage: {
      read: () => JSON.parse(JSON.stringify(state)) as MockState,
      write: (s) => void (state = JSON.parse(JSON.stringify(s)) as MockState),
    },
    bus: {
      post: (c) =>
        queueMicrotask(() => subs.forEach((f) => f(JSON.parse(JSON.stringify(c)) as ServerChange))),
      listen: (cb) => (subs.add(cb), () => void subs.delete(cb)),
    },
  };
}

export function browserTransport(): { storage: MockStorage; bus: MockBus } {
  const KEY = "fragolina.mock.server.v1";
  const bc = new BroadcastChannel("fragolina-mock-v1");
  return {
    storage: {
      read: () => {
        try {
          const raw = localStorage.getItem(KEY);
          return raw ? (JSON.parse(raw) as MockState) : emptyMockState();
        } catch {
          return emptyMockState();
        }
      },
      write: (s) => localStorage.setItem(KEY, JSON.stringify(s)),
    },
    bus: {
      post: (c) => bc.postMessage(c),
      listen: (cb) => {
        const h = (e: MessageEvent) => cb(e.data as ServerChange);
        bc.addEventListener("message", h);
        return () => bc.removeEventListener("message", h);
      },
    },
  };
}

export type MockOptions = {
  uid?: string;
  latencyMs?: [number, number];
  clock?: () => number;
  rng?: () => number;
  /** Per i test: attese senza timer reali. */
  sleep?: (ms: number) => Promise<void>;
};

const real = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class MockBackend implements Backend {
  readonly kind = "mock" as const;
  readonly server: MockServer;
  private offline = false;
  private statusHooks = new Set<() => void>();
  private readonly uid: string;
  private readonly latency: [number, number];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly bus: MockBus;

  constructor(transport: { storage: MockStorage; bus: MockBus }, opts: MockOptions = {}) {
    this.bus = transport.bus;
    this.server = new MockServer(transport.storage, (c) => this.bus.post(c), opts.clock, opts.rng);
    this.uid = opts.uid ?? uuid();
    this.latency = opts.latencyMs ?? [120, 380];
    this.sleep = opts.sleep ?? real;
  }

  get userId() {
    return this.uid;
  }
  isOffline() {
    return this.offline;
  }
  /** Interruttore "senza rete": ogni chiamata fallisce con errore di rete e la sottoscrizione cade. */
  setOffline(v: boolean) {
    if (this.offline === v) return;
    this.offline = v;
    this.statusHooks.forEach((f) => f());
  }

  private async wire<T>(fn: () => T): Promise<T> {
    if (this.offline) {
      await this.sleep(40);
      throw new BackendError("network", "Nessuna rete (prova)");
    }
    const [lo, hi] = this.latency;
    if (hi > 0) await this.sleep(lo + Math.random() * (hi - lo));
    if (this.offline) throw new BackendError("network", "Nessuna rete (prova)");
    return fn();
  }
  private ok<T extends object>(r: Res<T>): T {
    if (r.ok) return r as T;
    if (isGameReject(r.error)) throw new BackendError("game_rejected", r.error);
    const known: BackendErrorKind[] = [
      "rate_limited",
      "invalid_code",
      "code_expired",
      "couple_full",
      "already_paired",
      "not_paired",
      "closed",
      "name_required",
      "invalid_date",
      "no_partner",
      "cooldown",
      "not_hatched",
      "invalid_action",
      "invalid_content",
      "not_sharing",
      "invalid_location",
      "not_your_turn",
      "not_yours",
      "no_file",
    ];
    throw new BackendError(
      known.includes(r.error as BackendErrorKind) ? (r.error as BackendErrorKind) : "unknown",
      r.error,
    );
  }

  signInAnonymously() {
    return Promise.resolve({ userId: this.uid });
  }
  createCouple(displayName: string, startDate: string | null): Promise<CoupleCreated> {
    return this.wire(() => this.ok(this.server.createCouple(this.uid, displayName, startDate)));
  }
  joinCouple(code: string, displayName: string): Promise<CoupleJoined> {
    return this.wire(() => this.ok(this.server.joinCouple(this.uid, code, displayName)));
  }
  renewCode(): Promise<CodeRenewed> {
    return this.wire(() => this.ok(this.server.renewCode(this.uid)));
  }
  leave(): Promise<void> {
    return this.wire(() => void this.ok(this.server.leave(this.uid)));
  }
  releasePartner(): Promise<CodeRenewed> {
    return this.wire(() => this.ok(this.server.releasePartner(this.uid)));
  }
  getState(day: string, dayStartMs: number): Promise<RemoteState> {
    return this.wire(() => this.server.getState(this.uid, day, dayStartMs));
  }
  sendPing(coupleId: string, key: string): Promise<void> {
    return this.wire(() => void this.ok(this.server.insertPing(this.uid, coupleId, key)));
  }
  setMood(coupleId: string, moodId: MoodId, key: string, at: number): Promise<void> {
    return this.wire(
      () => void this.ok(this.server.insertMood(this.uid, coupleId, moodId, key, at)),
    );
  }
  answerDaily(
    coupleId: string,
    day: string,
    questionId: string,
    answer: DailyAnswer,
  ): Promise<void> {
    return this.wire(
      () => void this.ok(this.server.insertAnswer(this.uid, coupleId, day, questionId, answer)),
    );
  }
  setStartDate(startDate: string, at: number) {
    return this.wire(() => this.ok(this.server.setStartDate(this.uid, startDate, at)));
  }
  setDisplayName(name: string): Promise<void> {
    return this.wire(() => void this.ok(this.server.setDisplayName(this.uid, name)));
  }
  getPet(): Promise<PetSnapshot | null> {
    return this.wire(() => this.ok(this.server.getPet(this.uid)).snapshot);
  }
  petAct(a: PetActInput): Promise<PetState | null> {
    return this.wire(() => this.ok(this.server.petAct(this.uid, a)).pet);
  }
  setPetOutfit(outfit: Record<string, string | null>, at: number, key: string): Promise<PetState | null> {
    return this.wire(() => this.ok(this.server.setPetOutfit(this.uid, outfit, at, key)).pet);
  }
  setPetName(name: string, at: number, key: string): Promise<PetState | null> {
    return this.wire(() => this.ok(this.server.setPetName(this.uid, name, at, key)).pet);
  }

  getGames(): Promise<GamesSnapshot | null> {
    return this.wire(() => this.ok(this.server.getGames(this.uid)).snapshot);
  }
  startGame(a: { id: string; kind: GameKind; params: GameParams }): Promise<GameRow> {
    return this.wire(() => this.ok(this.server.startGame(this.uid, a)).game);
  }
  gameMove(a: { gameId: string; move: GameMove; key: string }): Promise<GameRow> {
    return this.wire(() => this.ok(this.server.gameMove(this.uid, a)).game);
  }
  abandonGame(a: { gameId: string; key: string }): Promise<GameRow> {
    return this.wire(() => this.ok(this.server.abandonGame(this.uid, a)).game);
  }
  getBoard(): Promise<Board | null> {
    return this.wire(() => this.ok(this.server.getBoard(this.uid)).board);
  }
  sendNote(a: { kind: NoteKind; content: NoteContent; key: string; at: number }): Promise<Note> {
    return this.wire(() => this.ok(this.server.sendNote(this.uid, a)).note);
  }
  clearNote(id: string | null): Promise<Note | null> {
    return this.wire(() => this.ok(this.server.clearNote(this.uid, id)).note);
  }
  // ---------- sessione 7 ----------
  getEvents(): Promise<CountdownEvent[] | null> {
    return this.wire(() => this.ok(this.server.extra.getEvents(this.uid)).events);
  }
  upsertEvent(a: { id: string; input: EventInput; at: number }): Promise<CountdownEvent[]> {
    return this.wire(() => this.ok(this.server.extra.upsertEvent(this.uid, a)).events);
  }
  deleteEvent(a: { id: string; at: number }): Promise<CountdownEvent[]> {
    return this.wire(() => this.ok(this.server.extra.deleteEvent(this.uid, a)).events);
  }
  getQa(todayRef: string): Promise<QaSnapshot | null> {
    return this.wire(() => this.ok(this.server.extra.getQa(this.uid, todayRef)).qa);
  }
  answerQa(a: { day: string; ref: string; text: string; key: string }): Promise<QaDay> {
    return this.wire(() => this.ok(this.server.extra.answerQa(this.uid, a)).day);
  }
  setTomorrowQuestion(text: string): Promise<QaDay> {
    return this.wire(() => this.ok(this.server.extra.setTomorrowQuestion(this.uid, text)).day);
  }
  getMemories(): Promise<Memory[] | null> {
    return this.wire(() => this.ok(this.server.extra.getMemories(this.uid)).memories);
  }
  addMemory(a: {
    id: string;
    kind: MemoryKind;
    source: MemorySource;
    caption: string;
    day: string;
    path: string | null;
    w: number | null;
    h: number | null;
    bytes: number | null;
    content: Memory["content"];
  }): Promise<Memory> {
    return this.wire(() => this.ok(this.server.extra.addMemory(this.uid, a)).memory);
  }
  deleteMemory(id: string): Promise<string | null> {
    return this.wire(() => this.ok(this.server.extra.deleteMemory(this.uid, id)).path);
  }
  async uploadMemoryPhoto(a: { path: string; uri: string }): Promise<void> {
    // il "file" finto vive come indirizzo `data:` (nel browser l'anteprima lo mostra com'è)
    let data = a.uri;
    if (!a.uri.startsWith("data:")) {
      const buf = await readPhotoBytes(a.uri);
      data = `data:image/jpeg;base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`;
    }
    return this.wire(() => void this.ok(this.server.extra.uploadFile(this.uid, a.path, data)));
  }
  removeMemoryFile(path: string): Promise<void> {
    return this.wire(() => void this.ok(this.server.extra.removeFile(this.uid, path)));
  }
  signMemoryUrls(paths: string[]): Promise<Record<string, string>> {
    return this.wire(() => this.ok(this.server.extra.signFiles(this.uid, paths)).urls);
  }
  getMonth(year: number, month: number): Promise<MonthRaw | null> {
    return this.wire(() => this.ok(this.server.extra.getMonth(this.uid, year, month)).month);
  }
  setLocationSharing(on: boolean): Promise<void> {
    return this.wire(() => void this.ok(this.server.setLocationSharing(this.uid, on)));
  }
  setLocation(p: { latE2: number; lonE2: number; at: number }): Promise<void> {
    return this.wire(() => void this.ok(this.server.setLocation(this.uid, p)));
  }
  createRecoveryCode(): Promise<{ code: string; expiresAt: number }> {
    return this.wire(() => {
      const r = this.ok(this.server.createRecoveryCode(this.uid));
      return { code: r.code, expiresAt: r.expiresAt };
    });
  }
  redeemRecoveryCode(code: string): Promise<void> {
    return this.wire(() => void this.ok(this.server.redeemRecoveryCode(this.uid, code)));
  }
  zoneGet(): Promise<ZSnapshot | null> {
    return this.wire(() => this.ok(this.server.zoneGet(this.uid)).snapshot);
  }
  zoneApply(op: ZOp): Promise<void> {
    return this.wire(() => void this.ok(this.server.zoneApply(this.uid, op)));
  }
  subscribeZone(coupleId: string, onPulse: () => void): () => void {
    return this.bus.listen((c) => {
      if (this.offline || c.coupleId !== coupleId || c.event.type !== "zone") return;
      void this.sleep(0).then(() => !this.offline && onPulse());
    });
  }
  setAppExpiry(ms: number): Promise<void> {
    return this.wire(() => void this.ok(this.server.setAppExpiry(this.uid, ms)));
  }
  getPartnerExpiry(): Promise<PartnerExpiry | null> {
    return this.wire(() => this.ok(this.server.getPartnerExpiry(this.uid)).partner);
  }
  rotateWidgetToken(): Promise<string> {
    return this.wire(() => this.ok(this.server.rotateWidgetToken(this.uid)).token);
  }

  subscribe(coupleId: string, h: SubscriptionHandlers): () => void {
    let alive = true;
    const off = this.bus.listen((c) => {
      if (!alive || this.offline || c.coupleId !== coupleId || c.event.type === "zone") return;
      if (c.actor === this.uid && c.event.type !== "couple" && c.event.type !== "member-joined") {
        // Anche il proprio inserimento torna indietro in tempo reale (come su Supabase): serve a provare la deduplica.
      }
      if (!this.server.canSee(this.uid, c)) return;
      const delay = this.latency[1] > 0 ? 60 + Math.random() * 140 : 0;
      void this.sleep(delay).then(() => alive && !this.offline && h.onEvent(c.event));
    });
    const hook = () => {
      if (!alive) return;
      h.onStatus(this.offline ? "down" : "live");
    };
    this.statusHooks.add(hook);
    void this.sleep(this.latency[1] > 0 ? 80 : 0).then(
      () => alive && h.onStatus(this.offline ? "down" : "live"),
    );
    return () => {
      alive = false;
      off();
      this.statusHooks.delete(hook);
    };
  }
}
