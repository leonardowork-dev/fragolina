import { type GamesDb, dbAbandon, dbMove, dbSnapshot, dbStart, emptyGamesDb } from "@/lib/games/engine";
import type { GameKind, GameMove, GameParams, GameRow, GamesSnapshot } from "@/lib/games/types";
import { uuid } from "@/lib/uuid";
import type { MoodId } from "@/features/home/moods";
import { MOOD_IDS } from "@/features/home/moods";
import {
  COOLDOWN_MS,
  FOOD_IDS,
  NAME_MAX,
  PET_KINDS,
  type PetKind,
  type PetState,
  applyAction,
  applyName,
  cleanPetName,
  emptyPet,
} from "@/lib/pet/rules";
import { NOTE_TTL_MS, type Note, type NoteContent, type NoteKind, validateContent } from "@/lib/note/rules";
import { validE2 } from "@/lib/geo/distance";
import type { LocationState, PartnerLocState } from "@/lib/geo/types";
import type { Board } from "@/lib/note/wire";
import type { PetLogEntry, PetSnapshot } from "@/lib/pet/sync";
import type { DailyAnswer, Member, RemoteEvent, RemoteState } from "@/lib/sync/types";
import { type ZoneCtx, type ZoneDb, emptyZoneDb, zoneApply, zoneSnapshot } from "@/lib/zone/engine";
import type { ZOp, ZSnapshot } from "@/lib/zone/types";
import { romeDayKey } from "@/lib/time";
import type { PartnerExpiry } from "../types";
import { type ExtraState, MockExtra, emptyExtra } from "./extra";

/**
 * "Server" finto: stesse regole del SQL in supabase/migrations (codici, limiti, RLS, last-write-wins, rivelazione
 * delle risposte), ma su un oggetto JSON. Così la prova a due schede nel browser e i test girano senza Supabase.
 * Funzioni sincrone e pure rispetto all'archivio iniettato (`MockStorage`).
 */
export type MockState = {
  couples: Record<
    string,
    {
      id: string;
      joinCode: string;
      expiresAt: number;
      startDate: string | null;
      startDateAt: number;
    }
  >;
  members: { coupleId: string; userId: string; displayName: string; role: "a" | "b" }[];
  moods: { coupleId: string; userId: string; moodId: MoodId; key: string; at: number }[];
  pings: { id: string; coupleId: string; fromUser: string; key: string; at: number }[];
  answers: {
    coupleId: string;
    userId: string;
    day: string;
    questionId: string;
    answer: DailyAnswer;
    at: number;
  }[];
  rate: { kind: "create" | "join_fail"; userId: string; at: number }[];
  /** Il pet (una riga per coppia) e il registro delle cure. Opzionali: i file salvati prima della sessione 4 non li hanno. */
  pets?: Record<string, PetState>;
  petLog?: (PetLogEntry & { coupleId: string; created: number })[];
  /** Biglietti, posizioni e token del widget (sessione 5). Opzionali: i file salvati prima non li hanno. */
  notes?: {
    id: string;
    coupleId: string;
    userId: string;
    kind: NoteKind;
    content: NoteContent;
    key: string;
    createdAt: number;
    expiresAt: number;
    clearedAt: number | null;
  }[];
  locations?: Record<string, { coupleId: string; sharing: boolean; latE2: number | null; lonE2: number | null; at: number }>;
  widgetTokens?: Record<string, string>;
  /** Zona privata (sessione 10): una base dati per coppia. */
  zone?: Record<string, ZoneDb>;
  /** Scadenza dell'app per persona (sessione 9), ms. */
  appExpiry?: Record<string, { at: number; reportedAt: number }>;
  /** Giochi (sessione 6): una "base dati" per coppia (le stesse funzioni pure del telefono e della prova SQL). */
  games?: Record<string, GamesDb>;
  /** Sessione 7: conto alla rovescia, domanda vera, ricordi, foto (Storage finto). Opzionale: i file salvati prima non lo hanno. */
  extra?: ExtraState;
};

export type MockStorage = { read(): MockState; write(s: MockState): void };
export type ServerChange = {
  coupleId: string;
  event: RemoteEvent;
  /** per le risposte: chi l'ha data */ actor: string;
};

export const emptyMockState = (): MockState => ({
  couples: {},
  members: [],
  moods: [],
  pings: [],
  answers: [],
  rate: [],
  pets: {},
  petLog: [],
  notes: [],
  locations: {},
  widgetTokens: {},
  games: {},
  extra: emptyExtra(),
});

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const DAY = 86_400_000;

export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export class MockServer {
  constructor(
    private readonly storage: MockStorage,
    private readonly emit: (c: ServerChange) => void,
    private readonly clock: () => number = Date.now,
    private readonly rng: () => number = Math.random,
  ) {
    this.extra = new MockExtra(
      () => this.storage.read(),
      (st) => this.storage.write(st),
      this.emit,
      () => this.clock(),
      (st, uid) => this.coupleOf(st, uid),
    );
  }

  /** Conto alla rovescia, domanda vera, ricordi, mese (sessione 7). */
  readonly extra: MockExtra;

  private genCode(s: MockState): string {
    for (;;) {
      let c = "";
      for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(this.rng() * CODE_ALPHABET.length)];
      if (!Object.values(s.couples).some((x) => x.joinCode === c)) return c;
    }
  }
  private coupleOf(s: MockState, uid: string) {
    return s.members.find((m) => m.userId === uid)?.coupleId ?? null;
  }
  private count(s: MockState, kind: "create" | "join_fail", since: number, uid?: string) {
    return s.rate.filter(
      (r) => r.kind === kind && r.at > since && (uid === undefined || r.userId === uid),
    ).length;
  }
  private freshCode(s: MockState, cid: string) {
    const code = this.genCode(s);
    s.couples[cid].joinCode = code;
    s.couples[cid].expiresAt = this.clock() + DAY;
    return code;
  }
  private coupleEvent(s: MockState, cid: string): RemoteEvent {
    const c = s.couples[cid];
    return {
      type: "couple",
      startDate: c.startDate,
      startDateAt: c.startDateAt,
      joinCode: c.joinCode,
      joinCodeExpiresAt: c.expiresAt,
    };
  }

  createCouple(
    uid: string,
    name: string,
    startDate: string | null,
  ): Res<{ coupleId: string; code: string; expiresAt: number; role: "a" }> {
    const s = this.storage.read();
    const now = this.clock();
    const nm = name.trim().slice(0, 24);
    if (!nm) return { ok: false, error: "name_required" };
    if (this.coupleOf(s, uid)) return { ok: false, error: "already_paired" };
    s.rate = s.rate.filter((r) => r.at > now - 2 * DAY);
    if (
      this.count(s, "create", now - DAY, uid) >= 3 ||
      this.count(s, "create", now - 3_600_000) >= 20
    )
      return { ok: false, error: "rate_limited" };
    s.rate.push({ kind: "create", userId: uid, at: now });
    const id = uuid();
    s.couples[id] = { id, joinCode: "", expiresAt: 0, startDate, startDateAt: now };
    s.members.push({ coupleId: id, userId: uid, displayName: nm, role: "a" });
    const code = this.freshCode(s, id);
    this.storage.write(s);
    return { ok: true, coupleId: id, code, expiresAt: s.couples[id].expiresAt, role: "a" };
  }

  joinCouple(
    uid: string,
    rawCode: string,
    name: string,
  ): Res<{ coupleId: string; role: "a" | "b" }> {
    const s = this.storage.read();
    const now = this.clock();
    const nm = name.trim().slice(0, 24);
    const code = rawCode.trim().toUpperCase();
    if (!nm) return { ok: false, error: "name_required" };
    if (this.coupleOf(s, uid)) return { ok: false, error: "already_paired" };
    if (
      this.count(s, "join_fail", now - 600_000, uid) >= 5 ||
      this.count(s, "join_fail", now - 600_000) >= 60
    )
      return { ok: false, error: "rate_limited" };
    const fail = (error: string): Res<never> => {
      s.rate.push({ kind: "join_fail", userId: uid, at: now });
      this.storage.write(s);
      return { ok: false, error };
    };
    if (!CODE_RE.test(code)) return fail("invalid_code");
    const c = Object.values(s.couples).find((x) => x.joinCode === code);
    if (!c) return fail("invalid_code");
    if (s.members.filter((m) => m.coupleId === c.id).length >= 2) return fail("couple_full");
    if (c.expiresAt < now) return fail("code_expired");
    const role: "a" | "b" = s.members.some((m) => m.coupleId === c.id && m.role === "a")
      ? "b"
      : "a";
    s.members.push({ coupleId: c.id, userId: uid, displayName: nm, role });
    c.expiresAt = now; // codice consumato
    this.storage.write(s);
    this.emit({
      coupleId: c.id,
      actor: uid,
      event: { type: "member-joined", member: { userId: uid, displayName: nm, role } },
    });
    this.emit({ coupleId: c.id, actor: uid, event: this.coupleEvent(s, c.id) });
    return { ok: true, coupleId: c.id, role };
  }

  renewCode(uid: string): Res<{ code: string; expiresAt: number }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if (s.members.filter((m) => m.coupleId === cid).length >= 2)
      return { ok: false, error: "couple_full" };
    const code = this.freshCode(s, cid);
    this.storage.write(s);
    return { ok: true, code, expiresAt: s.couples[cid].expiresAt };
  }

  leave(uid: string): Res {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: true };
    s.members = s.members.filter((m) => m.userId !== uid);
    if (!s.members.some((m) => m.coupleId === cid)) {
      delete s.couples[cid];
      s.moods = s.moods.filter((x) => x.coupleId !== cid);
      s.pings = s.pings.filter((x) => x.coupleId !== cid);
      s.answers = s.answers.filter((x) => x.coupleId !== cid);
      if (s.pets) delete s.pets[cid];
      if (s.petLog) s.petLog = s.petLog.filter((x) => x.coupleId !== cid);
      if (s.notes) s.notes = s.notes.filter((x) => x.coupleId !== cid);
      if (s.extra) {
        s.extra.events = s.extra.events.filter((x) => x.coupleId !== cid);
        s.extra.qaDays = s.extra.qaDays.filter((x) => x.coupleId !== cid);
        s.extra.qaAnswers = s.extra.qaAnswers.filter((x) => x.coupleId !== cid);
        s.extra.memories = s.extra.memories.filter((x) => x.coupleId !== cid);
        for (const p of Object.keys(s.extra.files)) if (p.startsWith(`${cid}/`)) delete s.extra.files[p];
      }
    } else this.freshCode(s, cid);
    // chi esce perde posizione e token (come il trigger tg_member_cleanup)
    if (s.locations) delete s.locations[uid];
    if (s.widgetTokens) delete s.widgetTokens[uid];
    if (s.appExpiry) delete s.appExpiry[uid];
    for (const zdb of Object.values(s.zone ?? {})) {
      zdb.wishes = zdb.wishes.filter((w) => w.userId !== uid);
      zdb.tonight = zdb.tonight.filter((t) => t.userId !== uid);
      zdb.signals = zdb.signals.filter((x) => x.userId !== uid);
    }
    this.storage.write(s);
    // Come su Supabase: le cancellazioni non arrivano in tempo reale (la RLS non può valutarle). Nessun emit.
    return { ok: true };
  }

  releasePartner(uid: string): Res<{ code: string; expiresAt: number }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const others = s.members.filter((m) => m.coupleId === cid && m.userId !== uid);
    if (!others.length) return { ok: false, error: "no_partner" };
    s.members = s.members.filter((m) => !(m.coupleId === cid && m.userId !== uid));
    const code = this.freshCode(s, cid);
    this.storage.write(s);
    return { ok: true, code, expiresAt: s.couples[cid].expiresAt };
  }

  setStartDate(uid: string, date: string, at: number): Res<{ startDate: string; at: number }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const now = this.clock();
    const [y, m, d] = date.split("-").map(Number);
    const t = Date.UTC(y, (m || 1) - 1, d || 1);
    if (!y || t > now + 2 * DAY || y < 1990) return { ok: false, error: "invalid_date" };
    const ts = Math.min(at, now);
    const c = s.couples[cid];
    if (!c.startDate || ts >= c.startDateAt) {
      c.startDate = date;
      c.startDateAt = ts;
      this.storage.write(s);
      this.emit({ coupleId: cid, actor: uid, event: this.coupleEvent(s, cid) });
    }
    return { ok: true, startDate: c.startDate!, at: c.startDateAt };
  }

  setDisplayName(uid: string, name: string): Res {
    const s = this.storage.read();
    const nm = name.trim().slice(0, 24);
    if (!nm) return { ok: false, error: "name_required" };
    const m = s.members.find((x) => x.userId === uid);
    if (!m) return { ok: false, error: "not_paired" };
    m.displayName = nm;
    this.storage.write(s);
    this.emit({
      coupleId: m.coupleId,
      actor: uid,
      event: { type: "member-renamed", userId: uid, displayName: nm },
    });
    return { ok: true };
  }

  /** Inserimenti diretti (come le policy: solo la propria coppia, idempotenti per chiave). */
  insertPing(uid: string, coupleId: string, key: string): Res {
    const s = this.storage.read();
    if (this.coupleOf(s, uid) !== coupleId) return { ok: false, error: "rls" };
    if (s.pings.some((p) => p.fromUser === uid && p.key === key)) return { ok: true };
    const now = this.clock();
    if (s.pings.filter((p) => p.fromUser === uid && p.at > now - 60_000).length >= 30)
      return { ok: false, error: "rate_limited" };
    const p = { id: uuid(), coupleId, fromUser: uid, key, at: now };
    s.pings.push(p);
    this.storage.write(s);
    this.emit({
      coupleId,
      actor: uid,
      event: { type: "ping", id: p.id, fromUserId: uid, at: now },
    });
    return { ok: true };
  }

  insertMood(uid: string, coupleId: string, moodId: MoodId, key: string, at: number): Res {
    const s = this.storage.read();
    if (this.coupleOf(s, uid) !== coupleId) return { ok: false, error: "rls" };
    if (!MOOD_IDS.includes(moodId)) return { ok: false, error: "check" };
    if (s.moods.some((m) => m.userId === uid && m.key === key)) return { ok: true };
    const now = this.clock();
    const ts = Math.min(at, now);
    s.moods.push({ coupleId, userId: uid, moodId, key, at: ts });
    this.storage.write(s);
    this.emit({ coupleId, actor: uid, event: { type: "mood", userId: uid, moodId, at: ts } });
    return { ok: true };
  }

  insertAnswer(
    uid: string,
    coupleId: string,
    day: string,
    questionId: string,
    answer: DailyAnswer,
  ): Res {
    const s = this.storage.read();
    if (this.coupleOf(s, uid) !== coupleId) return { ok: false, error: "rls" };
    if (s.answers.some((a) => a.coupleId === coupleId && a.userId === uid && a.day === day))
      return { ok: true }; // immutabile
    const now = this.clock();
    s.answers.push({ coupleId, userId: uid, day, questionId, answer, at: now });
    this.storage.write(s);
    this.emit({
      coupleId,
      actor: uid,
      event: { type: "answer", userId: uid, day, questionId, answer, at: now },
    });
    return { ok: true };
  }

  // ---------- pet (specchio di pet_act / set_pet_name / get_pet nel SQL) ----------
  petAct(
    uid: string,
    a: { kind: PetKind; item: string | null; amount: number; day: string; key: string; at: number },
  ): Res<{ pet: PetState; duplicate?: boolean; ignored?: boolean }> {
    const s = this.storage.read();
    const now = this.clock();
    if (
      !PET_KINDS.includes(a.kind) ||
      typeof a.key !== "string" ||
      a.key.length < 8 ||
      a.key.length > 64 ||
      (a.kind === "feed" && !(a.item && (FOOD_IDS as readonly string[]).includes(a.item)))
    )
      return { ok: false, error: "invalid_action" };
    const m = s.members.find((x) => x.userId === uid);
    if (!m) return { ok: false, error: "not_paired" };
    s.pets ??= {};
    s.petLog ??= [];
    const cid = m.coupleId;
    if (s.petLog.some((l) => l.userId === uid && l.key === a.key))
      return { ok: true, duplicate: true, pet: s.pets[cid] ?? emptyPet() };
    if (s.petLog.filter((l) => l.userId === uid && l.created > now - 60_000).length >= 60)
      return { ok: false, error: "rate_limited" };
    const cur = s.pets[cid] ?? emptyPet();
    const t = Math.max(Math.min(a.at, now), now - 172_800_000);
    const today = new Date(now).toISOString().slice(0, 10);
    const dayOk = Math.abs(Date.parse(a.day) - Date.parse(today)) <= 2 * DAY && /^\d{4}-\d{2}-\d{2}$/.test(a.day);
    if (a.kind !== "touch" && cur.hatchedAt === null) return { ok: false, error: "not_hatched" };
    if (COOLDOWN_MS[a.kind] > 0) {
      const last = Math.max(
        0,
        ...s.petLog.filter((l) => l.userId === uid && l.kind === a.kind).map((l) => l.at),
      );
      if (last && t - last < COOLDOWN_MS[a.kind]) return { ok: false, error: "cooldown" };
    }
    const r = applyAction(cur, {
      kind: a.kind,
      item: a.kind === "feed" ? (a.item as never) : null,
      amount: a.amount,
      role: m.role,
      userId: uid,
      at: t,
      day: dayOk ? a.day : today,
      key: a.key,
    });
    if (r.outcome === "bad_action") return { ok: false, error: "invalid_action" };
    if (r.outcome === "not_hatched") return { ok: false, error: "not_hatched" };
    if (r.pet.rev === cur.rev) return { ok: true, ignored: true, pet: cur };
    s.pets[cid] = r.pet;
    s.petLog.push({
      coupleId: cid,
      userId: uid,
      kind: r.pet.lastKind === "hatch" ? "hatch" : a.kind,
      item: a.kind === "feed" ? (a.item as never) : null,
      at: t,
      rev: r.pet.rev,
      key: a.key,
      created: now,
    });
    s.petLog = s.petLog.filter((l) => l.coupleId !== cid || l.rev >= r.pet.rev - 200);
    this.storage.write(s);
    this.emit({ coupleId: cid, actor: uid, event: { type: "pet", pet: r.pet } });
    return { ok: true, pet: r.pet };
  }

  setPetName(uid: string, name: string, at: number, key: string): Res<{ pet: PetState }> {
    const s = this.storage.read();
    const now = this.clock();
    const nm = cleanPetName(name).slice(0, NAME_MAX);
    if (!nm) return { ok: false, error: "name_required" };
    const m = s.members.find((x) => x.userId === uid);
    if (!m) return { ok: false, error: "not_paired" };
    const cur = s.pets?.[m.coupleId];
    if (!cur || cur.hatchedAt === null) return { ok: false, error: "not_hatched" };
    const t = Math.max(Math.min(at, now), now - 172_800_000);
    const next = applyName(cur, nm, t, key, uid);
    if (next.rev === cur.rev) return { ok: true, pet: cur };
    s.pets![m.coupleId] = next;
    this.storage.write(s);
    this.emit({ coupleId: m.coupleId, actor: uid, event: { type: "pet", pet: next } });
    return { ok: true, pet: next };
  }

  getPet(uid: string, limit = 12): Res<{ snapshot: PetSnapshot }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const log = (s.petLog ?? [])
      .filter((l) => l.coupleId === cid)
      .sort((x, y) => y.rev - x.rev)
      .slice(0, Math.min(Math.max(limit, 1), 30))
      .map(({ coupleId: _c, created: _t, ...e }) => e);
    const myLast: PetSnapshot["myLast"] = {};
    for (const l of s.petLog ?? [])
      if (l.userId === uid && l.kind !== "hatch" && l.kind !== "name")
        myLast[l.kind] = Math.max(myLast[l.kind] ?? 0, l.at);
    return { ok: true, snapshot: { state: s.pets?.[cid] ?? null, log, myLast } };
  }

  // ---------- giochi (specchio di start_game / game_move / abandon_game / get_games) ----------
  private gameCtx(s: MockState, uid: string): { cid: string; users: [string, string] } | { error: string } {
    const cid = this.coupleOf(s, uid);
    if (!cid) return { error: "not_paired" };
    const users = s.members.filter((m) => m.coupleId === cid).map((m) => m.userId);
    if (users.length < 2) return { error: "no_partner" };
    return { cid, users: [users[0], users[1]] };
  }
  private gameEvent(cid: string, uid: string, game: GameRow) {
    this.emit({ coupleId: cid, actor: uid, event: { type: "game", game } });
  }

  getGames(uid: string): Res<{ snapshot: GamesSnapshot }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    return { ok: true, snapshot: dbSnapshot(s.games?.[cid] ?? emptyGamesDb(), uid) };
  }
  startGame(uid: string, a: { id: string; kind: GameKind; params: GameParams }): Res<{ game: GameRow }> {
    const s = this.storage.read();
    const c = this.gameCtx(s, uid);
    if ("error" in c) return { ok: false, error: c.error };
    if (!["tris", "quiz", "draw"].includes(a.kind) || !a.id) return { ok: false, error: "invalid_action" };
    s.games ??= {};
    const db = (s.games[c.cid] ??= emptyGamesDb());
    const r = dbStart(db, c.users, uid, a.id, a.kind, a.params ?? {}, this.clock());
    if (!r.ok) return { ok: false, error: r.error };
    this.storage.write(s);
    if (!r.duplicate) this.gameEvent(c.cid, uid, r.game);
    return { ok: true, game: r.game };
  }
  gameMove(uid: string, a: { gameId: string; move: GameMove; key: string }): Res<{ game: GameRow }> {
    const s = this.storage.read();
    const c = this.gameCtx(s, uid);
    if ("error" in c) return { ok: false, error: c.error };
    if (!a.key || a.key.length < 8 || a.key.length > 64) return { ok: false, error: "invalid_action" };
    s.games ??= {};
    const db = (s.games[c.cid] ??= emptyGamesDb());
    const r = dbMove(db, c.users, uid, a.gameId, a.move, a.key, this.clock());
    if (!r.ok) return { ok: false, error: r.error };
    this.storage.write(s);
    if (!r.duplicate) this.gameEvent(c.cid, uid, r.game);
    return { ok: true, game: r.game };
  }
  abandonGame(uid: string, a: { gameId: string; key: string }): Res<{ game: GameRow }> {
    const s = this.storage.read();
    const c = this.gameCtx(s, uid);
    if ("error" in c) return { ok: false, error: c.error };
    s.games ??= {};
    const db = (s.games[c.cid] ??= emptyGamesDb());
    const before = db.games.find((g) => g.id === a.gameId)?.status;
    const r = dbAbandon(db, c.users, uid, a.gameId, this.clock());
    if (!r.ok) return { ok: false, error: r.error };
    this.storage.write(s);
    if (before === "open") this.gameEvent(c.cid, uid, r.game);
    return { ok: true, game: r.game };
  }

  // ---------- biglietti, distanza, token (specchio di send_note / clear_note / get_board / set_location…) ----------
  private noteView(n: NonNullable<MockState["notes"]>[number], viewer: string, s: MockState): Note {
    return {
      id: n.id,
      kind: n.kind,
      content: n.content,
      by: n.userId === viewer ? "me" : "partner",
      byName: s.members.find((m) => m.userId === n.userId)?.displayName ?? "",
      createdAt: n.createdAt,
      expiresAt: n.expiresAt,
      clearedAt: n.clearedAt,
    };
  }
  private noteRow(n: NonNullable<MockState["notes"]>[number]): RemoteEvent {
    return {
      type: "note",
      note: { id: n.id, kind: n.kind, content: n.content, userId: n.userId, createdAt: n.createdAt, expiresAt: n.expiresAt, clearedAt: n.clearedAt },
    };
  }

  sendNote(
    uid: string,
    a: { kind: NoteKind; content: NoteContent; key: string; at: number },
  ): Res<{ note: Note; duplicate?: boolean }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if ((a.kind !== "draw" && a.kind !== "text") || a.key.length < 8 || a.key.length > 64)
      return { ok: false, error: "invalid_action" };
    s.notes ??= [];
    const dup = s.notes.find((n) => n.userId === uid && n.key === a.key);
    if (dup) return { ok: true, duplicate: true, note: this.noteView(dup, uid, s) };
    const now = this.clock();
    if (s.notes.filter((n) => n.userId === uid && n.createdAt > now - 60_000).length >= 20)
      return { ok: false, error: "rate_limited" };
    if (validateContent(a.kind, a.content) !== null) return { ok: false, error: "invalid_content" };
    const n = { id: uuid(), coupleId: cid, userId: uid, kind: a.kind, content: a.content, key: a.key, createdAt: now, expiresAt: now + NOTE_TTL_MS, clearedAt: null as number | null };
    s.notes.push(n);
    const mine = s.notes.filter((x) => x.coupleId === cid).sort((x, y) => y.createdAt - x.createdAt);
    const drop = new Set(mine.slice(30).map((x) => x.id));
    if (drop.size) s.notes = s.notes.filter((x) => !drop.has(x.id));
    this.storage.write(s);
    this.emit({ coupleId: cid, actor: uid, event: this.noteRow(n) });
    return { ok: true, note: this.noteView(n, uid, s) };
  }

  clearNote(uid: string, id: string | null): Res<{ note: Note | null }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const list = (s.notes ?? []).filter((n) => n.coupleId === cid).sort((x, y) => y.createdAt - x.createdAt);
    const n = id === null ? list[0] : list.find((x) => x.id === id);
    if (!n) return { ok: true, note: null };
    if (n.clearedAt === null) {
      n.clearedAt = this.clock();
      this.storage.write(s);
      this.emit({ coupleId: cid, actor: uid, event: this.noteRow(n) });
    }
    return { ok: true, note: this.noteView(n, uid, s) };
  }

  private locState(s: MockState, uid: string): LocationState {
    const cid = this.coupleOf(s, uid);
    const mine = s.locations?.[uid];
    const me = mine && mine.latE2 !== null && mine.lonE2 !== null ? { latE2: mine.latE2, lonE2: mine.lonE2, at: mine.at } : null;
    const other = s.members.find((m) => m.coupleId === cid && m.userId !== uid);
    if (!other) return { sharing: !!mine?.sharing, me, partner: null };
    const theirs = s.locations?.[other.userId];
    const state: PartnerLocState = !mine?.sharing
      ? "mine_off"
      : !theirs
        ? "none"
        : !theirs.sharing
          ? "hidden"
          : theirs.latE2 === null
            ? "none"
            : "ok";
    return {
      sharing: !!mine?.sharing,
      me,
      partner: {
        name: other.displayName,
        state,
        latE2: state === "ok" ? theirs!.latE2 : null,
        lonE2: state === "ok" ? theirs!.lonE2 : null,
        at: state === "ok" ? theirs!.at : null,
      },
    };
  }

  getBoard(uid: string): Res<{ board: Board }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const last = (s.notes ?? []).filter((n) => n.coupleId === cid).sort((x, y) => y.createdAt - x.createdAt)[0];
    return { ok: true, board: { now: this.clock(), note: last ? this.noteView(last, uid, s) : null, location: this.locState(s, uid) } };
  }

  setLocationSharing(uid: string, on: boolean): Res {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    s.locations ??= {};
    const cur = s.locations[uid];
    s.locations[uid] = on
      ? { coupleId: cid, sharing: true, latE2: cur?.latE2 ?? null, lonE2: cur?.lonE2 ?? null, at: cur?.at ?? 0 }
      : { coupleId: cid, sharing: false, latE2: null, lonE2: null, at: 0 };
    this.storage.write(s);
    this.emit({ coupleId: cid, actor: uid, event: { type: "location" } });
    return { ok: true };
  }

  setLocation(uid: string, p: { latE2: number; lonE2: number; at: number }): Res<{ ignored?: boolean }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    if (!validE2(p)) return { ok: false, error: "invalid_location" };
    const cur = s.locations?.[uid];
    if (!cur?.sharing) return { ok: false, error: "not_sharing" };
    const now = this.clock();
    const t = Math.max(Math.min(p.at, now), now - 7 * DAY);
    if (t < cur.at) return { ok: true, ignored: true };
    s.locations![uid] = { ...cur, latE2: p.latE2, lonE2: p.lonE2, at: t };
    this.storage.write(s);
    this.emit({ coupleId: cid, actor: uid, event: { type: "location" } });
    return { ok: true };
  }

  private zoneCtx(s: MockState, uid: string): { cid: string; ctx: ZoneCtx } | null {
    const cid = this.coupleOf(s, uid);
    if (!cid) return null;
    const now = this.clock();
    return { cid, ctx: { uid, members: s.members.filter((m) => m.coupleId === cid).map((m) => ({ userId: m.userId, role: m.role })), now, today: romeDayKey(now) } };
  }
  zoneGet(uid: string): Res<{ snapshot: ZSnapshot }> {
    const s = this.storage.read();
    const z = this.zoneCtx(s, uid);
    if (!z) return { ok: false, error: "not_paired" };
    return { ok: true, snapshot: zoneSnapshot(s.zone?.[z.cid] ?? emptyZoneDb(), z.ctx) };
  }
  zoneApply(uid: string, op: ZOp): Res<object> {
    const s = this.storage.read();
    const z = this.zoneCtx(s, uid);
    if (!z) return { ok: false, error: "not_paired" };
    s.zone ??= {};
    const db = (s.zone[z.cid] ??= emptyZoneDb());
    const r = zoneApply(db, z.ctx, op);
    if (!r.ok) return { ok: false, error: r.error };
    this.storage.write(s);
    this.emit({ coupleId: z.cid, actor: uid, event: { type: "zone" } });
    return { ok: true };
  }

  setAppExpiry(uid: string, ms: number): Res<object> {
    const s = this.storage.read();
    if (!this.coupleOf(s, uid)) return { ok: false, error: "not_paired" };
    const now = this.clock();
    if (!Number.isFinite(ms) || ms < now - DAY || ms > now + 400 * DAY) return { ok: false, error: "invalid_content" };
    s.appExpiry ??= {};
    s.appExpiry[uid] = { at: Math.round(ms), reportedAt: now };
    this.storage.write(s);
    return { ok: true };
  }

  getPartnerExpiry(uid: string): Res<{ partner: PartnerExpiry | null }> {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    if (!cid) return { ok: false, error: "not_paired" };
    const other = s.members.find((m) => m.coupleId === cid && m.userId !== uid);
    if (!other) return { ok: true, partner: null };
    const e = s.appExpiry?.[other.userId];
    return { ok: true, partner: { name: other.displayName, expiresAt: e?.at ?? null, reportedAt: e?.reportedAt ?? null } };
  }

  rotateWidgetToken(uid: string): Res<{ token: string }> {
    const s = this.storage.read();
    if (!this.coupleOf(s, uid)) return { ok: false, error: "not_paired" };
    let token = "";
    for (let i = 0; i < 64; i++) token += "0123456789abcdef"[Math.floor(this.rng() * 16)];
    s.widgetTokens ??= {};
    s.widgetTokens[uid] = token;
    this.storage.write(s);
    return { ok: true, token };
  }

  /** Vero se `uid` può vedere questo evento (stessa regola della RLS). */
  canSee(uid: string, c: ServerChange): boolean {
    const s = this.storage.read();
    if (this.coupleOf(s, uid) !== c.coupleId) return false;
    if (c.event.type === "location" && c.actor !== uid) return !!s.locations?.[uid]?.sharing;
    if (c.event.type === "answer" && c.actor !== uid) {
      const day = c.event.day;
      return s.answers.some((a) => a.userId === uid && a.day === day && a.coupleId === c.coupleId);
    }
    return true;
  }

  getState(uid: string, day: string, dayStartMs: number): RemoteState {
    const s = this.storage.read();
    const cid = this.coupleOf(s, uid);
    const empty: RemoteState = {
      paired: false,
      userId: uid,
      couple: null,
      members: [],
      myMood: null,
      partnerMood: null,
      pingsSentToday: 0,
      pingsReceivedTotal: 0,
      lastPingReceivedAt: null,
      lastPingSentAt: null,
      myAnswer: null,
      partnerAnswer: null,
    };
    if (!cid) return empty;
    const c = s.couples[cid];
    const latest = (userIdFilter: (u: string) => boolean) => {
      const list = s.moods
        .filter((m) => m.coupleId === cid && userIdFilter(m.userId))
        .sort((a, b) => b.at - a.at);
      return list[0] ? { moodId: list[0].moodId, at: list[0].at } : null;
    };
    const mine = s.answers.find((a) => a.coupleId === cid && a.userId === uid && a.day === day);
    const theirs = mine
      ? s.answers.find((a) => a.coupleId === cid && a.userId !== uid && a.day === day)
      : undefined;
    const pr = s.pings.filter((p) => p.coupleId === cid && p.fromUser !== uid);
    const ps = s.pings.filter((p) => p.coupleId === cid && p.fromUser === uid);
    const members: Member[] = s.members
      .filter((m) => m.coupleId === cid)
      .map((m) => ({ userId: m.userId, displayName: m.displayName, role: m.role }))
      .sort((a, b) => a.role.localeCompare(b.role));
    return {
      paired: true,
      userId: uid,
      couple: {
        id: cid,
        joinCode: c.joinCode,
        joinCodeExpiresAt: c.expiresAt,
        startDate: c.startDate,
        startDateAt: c.startDateAt,
      },
      members,
      myMood: latest((u) => u === uid),
      partnerMood: latest((u) => u !== uid),
      pingsSentToday: ps.filter((p) => p.at >= dayStartMs).length,
      pingsReceivedTotal: pr.length,
      lastPingReceivedAt: pr.length ? Math.max(...pr.map((p) => p.at)) : null,
      lastPingSentAt: ps.length ? Math.max(...ps.map((p) => p.at)) : null,
      myAnswer: mine ? { questionId: mine.questionId, answer: mine.answer, at: mine.at } : null,
      partnerAnswer: theirs
        ? { questionId: theirs.questionId, answer: theirs.answer, at: theirs.at }
        : null,
    };
  }
}
