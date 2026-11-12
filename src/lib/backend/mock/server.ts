import { uuid } from "@/lib/uuid";
import type { MoodId } from "@/features/home/moods";
import { MOOD_IDS } from "@/features/home/moods";
import type { DailyAnswer, Member, RemoteEvent, RemoteState } from "@/lib/sync/types";

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
  ) {}

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
    } else this.freshCode(s, cid);
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

  /** Vero se `uid` può vedere questo evento (stessa regola della RLS). */
  canSee(uid: string, c: ServerChange): boolean {
    const s = this.storage.read();
    if (this.coupleOf(s, uid) !== c.coupleId) return false;
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
