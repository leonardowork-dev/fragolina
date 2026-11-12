import { type RealtimeChannel, type SupabaseClient, createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { MoodId } from "@/features/home/moods";
import {
  BackendError,
  type BackendErrorKind,
  type DailyAnswer,
  type RemoteState,
  type Role,
} from "@/lib/sync/types";

import type {
  Backend,
  CodeRenewed,
  CoupleCreated,
  CoupleJoined,
  SubscriptionHandlers,
} from "../types";
import { secureSessionStorage } from "./secureStorage";

if (Platform.OS !== "web") {
  // Hermes ha un URL incompleto: supabase-js ne ha bisogno. Solo JavaScript, nessun modulo nativo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- caricamento pigro: solo la piattaforma/backend che serve
  require("react-native-url-polyfill/auto");
}

const ms = (v: unknown): number | null => (typeof v === "string" ? Date.parse(v) : null);
const KNOWN: BackendErrorKind[] = [
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
];

type AnyErr =
  { message?: string; code?: string; status?: number; name?: string } | null | undefined;

/** Traduce gli errori di Supabase nei nostri: rete (si riprova), sessione, regole del database. */
export function classify(err: AnyErr, status?: number): BackendError {
  const msg = String(err?.message ?? "");
  if (KNOWN.includes(msg as BackendErrorKind))
    return new BackendError(msg as BackendErrorKind, msg);
  if (/rate_limited|too many/i.test(msg) || status === 429 || err?.status === 429)
    return new BackendError("rate_limited", msg);
  if (
    status === 0 ||
    /fetch|network|timeout|abort|offline|ENOTFOUND|ECONN/i.test(msg) ||
    /Retryable/i.test(String(err?.name))
  )
    return new BackendError("network", msg);
  if (
    status === 401 ||
    err?.status === 401 ||
    /jwt|token|refresh|not.authenticated|session/i.test(msg)
  )
    return new BackendError("session", msg);
  if (err?.code === "42501" || status === 403) return new BackendError("not_paired", msg);
  return new BackendError("unknown", msg);
}

export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: {
        storage: secureSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }

  setForeground(active: boolean) {
    try {
      if (active) void this.client.auth.startAutoRefresh();
      else void this.client.auth.stopAutoRefresh();
    } catch {
      /* niente */
    }
  }

  async signInAnonymously() {
    const got = await this.client.auth.getSession();
    if (got.error) {
      const e = classify(got.error);
      // Mai creare un'identità nuova per un semplice errore di rete: la sessione vecchia è ancora buona.
      if (e.kind === "network") throw e;
    }
    if (got.data.session) return { userId: got.data.session.user.id };
    const r = await this.client.auth.signInAnonymously();
    if (r.error || !r.data.user) throw classify(r.error, r.error?.status);
    return { userId: r.data.user.id };
  }

  private async rpc<T extends object>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let res;
    try {
      res = await this.client.rpc(fn, args);
    } catch (e) {
      throw classify({ message: String(e) });
    }
    if (res.error) throw classify(res.error, res.status);
    const d = res.data as ({ ok?: boolean; error?: string } & T) | null;
    if (d && d.ok === false) throw classify({ message: d.error }, 400);
    return (d ?? {}) as T;
  }

  async createCouple(displayName: string, startDate: string | null): Promise<CoupleCreated> {
    const d = await this.rpc<{ couple_id: string; code: string; expires_at: string; role: Role }>(
      "create_couple",
      { p_display_name: displayName, p_start_date: startDate },
    );
    return {
      coupleId: d.couple_id,
      code: d.code,
      expiresAt: ms(d.expires_at) ?? Date.now() + 864e5,
      role: d.role,
    };
  }
  async joinCouple(code: string, displayName: string): Promise<CoupleJoined> {
    const d = await this.rpc<{ couple_id: string; role: Role }>("join_couple", {
      p_code: code,
      p_display_name: displayName,
    });
    return { coupleId: d.couple_id, role: d.role };
  }
  async renewCode(): Promise<CodeRenewed> {
    const d = await this.rpc<{ code: string; expires_at: string }>("renew_join_code");
    return { code: d.code, expiresAt: ms(d.expires_at) ?? Date.now() + 864e5 };
  }
  async leave() {
    await this.rpc("leave_couple");
  }
  async releasePartner(): Promise<CodeRenewed> {
    const d = await this.rpc<{ code: string; expires_at: string }>("release_partner");
    return { code: d.code, expiresAt: ms(d.expires_at) ?? Date.now() + 864e5 };
  }

  async getState(day: string, dayStartMs: number): Promise<RemoteState> {
    type Stamped = {
      mood_id?: string;
      at?: string;
      question_id?: string;
      answer?: DailyAnswer;
    } | null;
    const d = await this.rpc<{
      paired: boolean;
      user_id: string;
      couple?: {
        id: string;
        join_code: string | null;
        join_code_expires_at: string | null;
        start_date: string | null;
        start_date_updated_at: string;
      };
      members?: { user_id: string; display_name: string; role: Role }[];
      my_mood?: Stamped;
      partner_mood?: Stamped;
      pings_sent_today?: number;
      pings_received_total?: number;
      last_ping_received_at?: string | null;
      last_ping_sent_at?: string | null;
      my_answer?: Stamped;
      partner_answer?: Stamped;
    }>("get_state", { p_day: day, p_day_start: new Date(dayStartMs).toISOString() });
    const mood = (m: Stamped | undefined) =>
      m && m.mood_id ? { moodId: m.mood_id as MoodId, at: ms(m.at) ?? 0 } : null;
    const ans = (a: Stamped | undefined) =>
      a && a.answer
        ? { questionId: a.question_id ?? "", answer: a.answer, at: ms(a.at) ?? 0 }
        : null;
    return {
      paired: !!d.paired && !!d.couple,
      userId: d.user_id,
      couple: d.couple
        ? {
            id: d.couple.id,
            joinCode: d.couple.join_code,
            joinCodeExpiresAt: ms(d.couple.join_code_expires_at),
            startDate: d.couple.start_date,
            startDateAt: ms(d.couple.start_date_updated_at) ?? 0,
          }
        : null,
      members: (d.members ?? []).map((m) => ({
        userId: m.user_id,
        displayName: m.display_name,
        role: m.role,
      })),
      myMood: mood(d.my_mood),
      partnerMood: mood(d.partner_mood),
      pingsSentToday: d.pings_sent_today ?? 0,
      pingsReceivedTotal: d.pings_received_total ?? 0,
      lastPingReceivedAt: ms(d.last_ping_received_at),
      lastPingSentAt: ms(d.last_ping_sent_at),
      myAnswer: ans(d.my_answer),
      partnerAnswer: ans(d.partner_answer),
    };
  }

  private async insert(table: string, row: Record<string, unknown>, onConflict: string) {
    let res;
    try {
      res = await this.client.from(table).upsert(row, { onConflict, ignoreDuplicates: true });
    } catch (e) {
      throw classify({ message: String(e) });
    }
    if (res.error) throw classify(res.error, res.status);
  }

  async sendPing(coupleId: string, key: string) {
    const me = (await this.client.auth.getSession()).data.session?.user.id;
    if (!me) throw new BackendError("session");
    await this.insert(
      "pings",
      { couple_id: coupleId, from_user: me, client_key: key },
      "from_user,client_key",
    );
  }
  async setMood(coupleId: string, moodId: MoodId, key: string, at: number) {
    const me = (await this.client.auth.getSession()).data.session?.user.id;
    if (!me) throw new BackendError("session");
    await this.insert(
      "mood_events",
      {
        couple_id: coupleId,
        user_id: me,
        mood_id: moodId,
        client_key: key,
        client_at: new Date(at).toISOString(),
      },
      "user_id,client_key",
    );
  }
  async answerDaily(coupleId: string, day: string, questionId: string, answer: DailyAnswer) {
    const me = (await this.client.auth.getSession()).data.session?.user.id;
    if (!me) throw new BackendError("session");
    await this.insert(
      "daily_answers",
      { couple_id: coupleId, user_id: me, day, question_id: questionId, answer },
      "couple_id,user_id,day",
    );
  }
  async setStartDate(startDate: string, at: number) {
    const d = await this.rpc<{ start_date: string; updated_at: string }>("set_start_date", {
      p_date: startDate,
      p_client_at: new Date(at).toISOString(),
    });
    return { startDate: d.start_date, at: ms(d.updated_at) ?? at };
  }
  async setDisplayName(name: string) {
    await this.rpc("set_display_name", { p_name: name });
  }

  subscribe(coupleId: string, h: SubscriptionHandlers): () => void {
    let ch: RealtimeChannel | null = this.client.channel(
      `couple-${coupleId}-${Math.random().toString(36).slice(2, 8)}`,
    );
    type P = { new: Record<string, unknown> };
    const f = `couple_id=eq.${coupleId}`;
    const s = "public";
    ch.on("postgres_changes", { event: "INSERT", schema: s, table: "pings", filter: f }, (p: P) =>
      h.onEvent({
        type: "ping",
        id: String(p.new.id),
        fromUserId: String(p.new.from_user),
        at: ms(p.new.created_at) ?? Date.now(),
      }),
    )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: s, table: "mood_events", filter: f },
        (p: P) =>
          h.onEvent({
            type: "mood",
            userId: String(p.new.user_id),
            moodId: p.new.mood_id as MoodId,
            at: ms(p.new.client_at) ?? ms(p.new.created_at) ?? Date.now(),
          }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: s, table: "daily_answers", filter: f },
        (p: P) =>
          h.onEvent({
            type: "answer",
            userId: String(p.new.user_id),
            day: String(p.new.day),
            questionId: String(p.new.question_id),
            answer: p.new.answer as DailyAnswer,
            at: ms(p.new.answered_at) ?? Date.now(),
          }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: s, table: "couples", filter: `id=eq.${coupleId}` },
        (p: P) =>
          h.onEvent({
            type: "couple",
            startDate: (p.new.relationship_start_date as string | null) ?? null,
            startDateAt: ms(p.new.start_date_updated_at) ?? 0,
            joinCode: (p.new.join_code as string | null) ?? null,
            joinCodeExpiresAt: ms(p.new.join_code_expires_at),
          }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: s, table: "couple_members", filter: f },
        (p: P) =>
          h.onEvent({
            type: "member-joined",
            member: {
              userId: String(p.new.user_id),
              displayName: String(p.new.display_name),
              role: p.new.role as Role,
            },
          }),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: s, table: "couple_members", filter: f },
        (p: P) =>
          h.onEvent({
            type: "member-renamed",
            userId: String(p.new.user_id),
            displayName: String(p.new.display_name),
          }),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") h.onStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          h.onStatus("down");
      });
    return () => {
      const c = ch;
      ch = null;
      if (c) void this.client.removeChannel(c);
    };
  }
}
