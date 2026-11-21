import { type RealtimeChannel, type SupabaseClient, createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { MoodId } from "@/features/home/moods";
import { isGameReject } from "@/lib/games/errors";
import type { GameKind, GameMove, GameParams, GameRow } from "@/lib/games/types";
import { gameFromJson, gameFromRecord, gamesSnapshotFromJson } from "@/lib/games/wire";
import type { Note, NoteContent, NoteKind } from "@/lib/note/rules";
import { boardFromJson, noteFromJson, noteRowFromRecord } from "@/lib/note/wire";
import { petFromRow, petSnapshotFromJson } from "@/lib/pet/wire";
import type { CountdownEvent, EventInput } from "@/lib/countdown/rules";
import { eventsFromJson } from "@/lib/countdown/sync";
import type { ZOp, ZSnapshot } from "@/lib/zone/types";
import { zoneSnapshotFromJson } from "@/lib/zone/wire";
import { type MonthRaw, monthRawFromJson } from "@/lib/memories/month";
import { readPhotoBytes } from "@/lib/memories/photoDevice";
import { type Memory, type MemoryKind, type MemorySource, memoriesFromJson, memoryFromJson } from "@/lib/memories/types";
import { type QaDay, type QaSnapshot, qaDayFromJson, qaSnapshotFromJson } from "@/lib/qa/rules";
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
  PartnerExpiry,
  PetActInput,
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

/** La funzione non esiste sul server: la migrazione non è ancora stata eseguita. Non è un errore dell'app. */
const isMissing = (e: unknown, fn: string) =>
  e instanceof BackendError && new RegExp(`${fn}|PGRST202|Could not find|does not exist`, "i").test(e.message);
const BUCKET = "memories";

type AnyErr =
  { message?: string; code?: string; status?: number; name?: string } | null | undefined;

/** Traduce gli errori di Supabase nei nostri: rete (si riprova), sessione, regole del database. */
export function classify(err: AnyErr, status?: number): BackendError {
  const msg = String(err?.message ?? "");
  if (isGameReject(msg)) return new BackendError("game_rejected", msg);
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

  async getPet() {
    try {
      const d = await this.rpc<Parameters<typeof petSnapshotFromJson>[0]>("get_pet", { p_limit: 12 });
      return petSnapshotFromJson(d);
    } catch (e) {
      // Migrazione del pet non ancora eseguita sul server: la funzione non esiste. Non è un errore dell'app.
      if (e instanceof BackendError && /get_pet|PGRST202|Could not find|does not exist/i.test(e.message))
        return null;
      throw e;
    }
  }
  async petAct(a: PetActInput) {
    const d = await this.rpc<{ pet?: Record<string, unknown> | null }>("pet_act", {
      p_kind: a.kind,
      p_item: a.item,
      p_amount: a.amount,
      p_day: a.day,
      p_client_key: a.key,
      p_client_at: Math.round(a.at),
    });
    return d.pet ? petFromRow(d.pet) : null;
  }
  async setPetName(name: string, at: number, key: string) {
    const d = await this.rpc<{ pet?: Record<string, unknown> | null }>("set_pet_name", {
      p_name: name,
      p_client_at: Math.round(at),
      p_client_key: key,
    });
    return d.pet ? petFromRow(d.pet) : null;
  }

  async getBoard() {
    try {
      const d = await this.rpc<Record<string, unknown>>("get_board");
      return boardFromJson(d);
    } catch (e) {
      // Migrazione dei biglietti non ancora eseguita sul server: la funzione non esiste. Non è un errore dell'app.
      if (e instanceof BackendError && /get_board|PGRST202|Could not find|does not exist/i.test(e.message)) return null;
      throw e;
    }
  }
  async sendNote(a: { kind: NoteKind; content: NoteContent; key: string; at: number }): Promise<Note> {
    const d = await this.rpc<{ note?: unknown }>("send_note", {
      p_kind: a.kind,
      p_content: a.content,
      p_client_key: a.key,
      p_client_at: Math.round(a.at),
    });
    const n = noteFromJson(d.note);
    if (!n) throw new BackendError("unknown", "risposta senza biglietto");
    return n;
  }
  async clearNote(id: string | null): Promise<Note | null> {
    const d = await this.rpc<{ note?: unknown }>("clear_note", { p_id: id });
    return noteFromJson(d.note);
  }
  async getGames() {
    try {
      const d = await this.rpc<Record<string, unknown>>("get_games");
      return gamesSnapshotFromJson(d);
    } catch (e) {
      // Migrazione dei giochi non ancora eseguita sul server: la funzione non esiste. Non è un errore dell'app.
      if (e instanceof BackendError && /get_games|PGRST202|Could not find|does not exist/i.test(e.message)) return null;
      throw e;
    }
  }
  private gameOf(d: { game?: unknown }): GameRow {
    const g = gameFromJson(d.game);
    if (!g) throw new BackendError("unknown", "risposta senza partita");
    return g;
  }
  async startGame(a: { id: string; kind: GameKind; params: GameParams }): Promise<GameRow> {
    return this.gameOf(await this.rpc<{ game?: unknown }>("start_game", { p_id: a.id, p_kind: a.kind, p_params: a.params }));
  }
  async gameMove(a: { gameId: string; move: GameMove; key: string }): Promise<GameRow> {
    return this.gameOf(await this.rpc<{ game?: unknown }>("game_move", { p_game: a.gameId, p_move: a.move, p_client_key: a.key }));
  }
  async abandonGame(a: { gameId: string; key: string }): Promise<GameRow> {
    return this.gameOf(await this.rpc<{ game?: unknown }>("abandon_game", { p_game: a.gameId, p_client_key: a.key }));
  }
  // ---------- sessione 7 ----------
  async getEvents(): Promise<CountdownEvent[] | null> {
    try {
      return eventsFromJson((await this.rpc<{ events?: unknown }>("get_events")).events);
    } catch (e) {
      if (isMissing(e, "get_events")) return null;
      throw e;
    }
  }
  async upsertEvent(a: { id: string; input: EventInput; at: number }): Promise<CountdownEvent[]> {
    const d = await this.rpc<{ events?: unknown }>("upsert_event", {
      p_id: a.id,
      p_title: a.input.title,
      p_date: a.input.date,
      p_time: a.input.time,
      p_icon: a.input.icon,
      p_featured: a.input.featured,
      p_at: Math.round(a.at),
    });
    return eventsFromJson(d.events);
  }
  async deleteEvent(a: { id: string; at: number }): Promise<CountdownEvent[]> {
    return eventsFromJson((await this.rpc<{ events?: unknown }>("delete_event", { p_id: a.id, p_at: Math.round(a.at) })).events);
  }
  async getQa(todayRef: string): Promise<QaSnapshot | null> {
    try {
      return qaSnapshotFromJson(await this.rpc<Record<string, unknown>>("get_qa", { p_today_ref: todayRef }));
    } catch (e) {
      if (isMissing(e, "get_qa")) return null;
      throw e;
    }
  }
  private qaDayOf(d: { day?: unknown }): QaDay {
    const x = qaDayFromJson(d.day);
    if (!x) throw new BackendError("unknown", "risposta senza giorno");
    return x;
  }
  async answerQa(a: { day: string; ref: string; text: string; key: string }): Promise<QaDay> {
    return this.qaDayOf(await this.rpc<{ day?: unknown }>("answer_qa", { p_day: a.day, p_ref: a.ref, p_text: a.text, p_client_key: a.key }));
  }
  async setTomorrowQuestion(text: string): Promise<QaDay> {
    return this.qaDayOf(await this.rpc<{ day?: unknown }>("set_tomorrow_question", { p_text: text }));
  }
  async getMemories(): Promise<Memory[] | null> {
    try {
      return memoriesFromJson((await this.rpc<{ memories?: unknown }>("get_memories")).memories);
    } catch (e) {
      if (isMissing(e, "get_memories")) return null;
      throw e;
    }
  }
  async addMemory(a: {
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
    const d = await this.rpc<{ memory?: unknown }>("add_memory", {
      p_id: a.id,
      p_kind: a.kind,
      p_source: a.source,
      p_caption: a.caption,
      p_day: a.day,
      p_path: a.path,
      p_w: a.w,
      p_h: a.h,
      p_bytes: a.bytes,
      p_content: a.content,
    });
    const m = memoryFromJson(d.memory);
    if (!m) throw new BackendError("unknown", "risposta senza ricordo");
    return m;
  }
  async deleteMemory(id: string): Promise<string | null> {
    const d = await this.rpc<{ path?: string | null }>("delete_memory", { p_id: id });
    return typeof d.path === "string" ? d.path : null;
  }
  async uploadMemoryPhoto(a: { path: string; uri: string }): Promise<void> {
    let bytes: ArrayBuffer;
    try {
      bytes = await readPhotoBytes(a.uri);
    } catch {
      throw new BackendError("invalid_action", "file locale non leggibile");
    }
    let res;
    try {
      res = await this.client.storage.from(BUCKET).upload(a.path, bytes, { contentType: "image/jpeg", upsert: false });
    } catch (e) {
      throw classify({ message: String(e) });
    }
    if (!res.error) return;
    const msg = String(res.error.message ?? "");
    // già caricata (un ritentativo dopo un errore di rete): va bene
    if (/already exists|duplicate|resource already/i.test(msg) || (res.error as { statusCode?: string }).statusCode === "409") return;
    throw classify(res.error, (res.error as { statusCode?: number }).statusCode ? Number((res.error as { statusCode?: number }).statusCode) : undefined);
  }
  async removeMemoryFile(path: string): Promise<void> {
    let res;
    try {
      res = await this.client.storage.from(BUCKET).remove([path]);
    } catch (e) {
      throw classify({ message: String(e) });
    }
    if (res.error) throw classify(res.error);
  }
  async signMemoryUrls(paths: string[]): Promise<Record<string, string>> {
    if (!paths.length) return {};
    let res;
    try {
      res = await this.client.storage.from(BUCKET).createSignedUrls(paths, 600);
    } catch (e) {
      throw classify({ message: String(e) });
    }
    if (res.error) throw classify(res.error);
    const out: Record<string, string> = {};
    for (const r of res.data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
    return out;
  }
  async getMonth(year: number, month: number): Promise<MonthRaw | null> {
    try {
      return monthRawFromJson(await this.rpc<Record<string, unknown>>("get_month", { p_year: year, p_month: month }));
    } catch (e) {
      if (isMissing(e, "get_month")) return null;
      throw e;
    }
  }

  async setLocationSharing(on: boolean) {
    await this.rpc("set_location_sharing", { p_on: on });
  }
  async setLocation(p: { latE2: number; lonE2: number; at: number }) {
    await this.rpc("set_location", { p_lat_e2: p.latE2, p_lon_e2: p.lonE2, p_at: Math.round(p.at) });
  }
  async zoneGet(): Promise<ZSnapshot | null> {
    try {
      return zoneSnapshotFromJson(await this.rpc<object>("z_get"));
    } catch (e) {
      if (isMissing(e, "z_get")) return null;
      throw e;
    }
  }
  async zoneApply(op: ZOp): Promise<void> {
    const call = (fn: string, args?: Record<string, unknown>) => this.rpc(fn, args);
    switch (op.kind) {
      case "log":
        return void (await call("z_log", { p_id: op.id, p_day: op.day, p_at: Math.round(op.at), p_place: op.place, p_starter: op.starter, p_rating: op.rating, p_note: op.note }));
      case "logDelete":
        return void (await call("z_log_delete", { p_id: op.id }));
      case "wish":
        return void (await call("z_wish", { p_idea: op.idea, p_on: op.on }));
      case "ideaAdd":
        return void (await call("z_idea_add", { p_id: op.id, p_text: op.text, p_level: op.level }));
      case "ideaDelete":
        return void (await call("z_idea_delete", { p_id: op.id }));
      case "tonight":
        return void (await call("z_tonight", { p_answer: op.answer }));
      case "signal":
        return void (await call("z_signal", { p_level: op.level }));
      case "signalClear":
        return void (await call("z_signal_clear"));
      case "voucherAdd":
        return void (await call("z_voucher_add", { p_id: op.id, p_title: op.title, p_expires: op.expires }));
      case "voucherRedeem":
        return void (await call("z_voucher_redeem", { p_id: op.id }));
      case "voucherDelete":
        return void (await call("z_voucher_delete", { p_id: op.id }));
      case "wipe":
        return void (await call("z_wipe"));
    }
  }
  /** Tempo reale: SOLO il contatore `z_pulse` (nessun contenuto). Quando cambia, il telefono rilegge con z_get. */
  subscribeZone(coupleId: string, onPulse: () => void): () => void {
    const ch: RealtimeChannel = this.client
      .channel(`zone-${coupleId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "z_pulse", filter: `couple_id=eq.${coupleId}` }, () => onPulse());
    ch.subscribe();
    return () => {
      void this.client.removeChannel(ch);
    };
  }
  async setAppExpiry(ms: number) {
    try {
      await this.rpc("set_app_expiry", { p_at: Math.round(ms) });
    } catch (e) {
      if (isMissing(e, "set_app_expiry")) return; // migrazione della sessione 9 non ancora sul server
      throw e;
    }
  }
  async getPartnerExpiry(): Promise<PartnerExpiry | null> {
    try {
      const d = await this.rpc<{ partner?: { name?: unknown; expiresAt?: unknown; reportedAt?: unknown } | null }>(
        "get_partner_expiry",
      );
      const p = d.partner;
      if (!p || typeof p.name !== "string") return null;
      const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      return { name: p.name, expiresAt: n(p.expiresAt), reportedAt: n(p.reportedAt) };
    } catch (e) {
      if (isMissing(e, "get_partner_expiry")) return null;
      throw e;
    }
  }
  async rotateWidgetToken() {
    const d = await this.rpc<{ token?: string }>("rotate_widget_token");
    if (!d.token) throw new BackendError("unknown", "risposta senza token");
    return d.token;
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
    // Canale a parte per il pet: se il server non ha ancora la tabella (migrazione non eseguita) questo canale
    // può andare in errore senza far cadere il collegamento principale (umori, pensieri).
    let petCh: RealtimeChannel | null = this.client.channel(
      `pet-${coupleId}-${Math.random().toString(36).slice(2, 8)}`,
    );
    petCh
      .on(
        "postgres_changes",
        { event: "*", schema: s, table: "pets", filter: f },
        (p: P) => h.onEvent({ type: "pet", pet: petFromRow(p.new) }),
      )
      .subscribe();
    // Altro canale a parte: biglietti e posizioni (stessa ragione del pet: la migrazione può mancare).
    let boardCh: RealtimeChannel | null = this.client.channel(
      `board-${coupleId}-${Math.random().toString(36).slice(2, 8)}`,
    );
    boardCh
      .on("postgres_changes", { event: "*", schema: s, table: "notes", filter: f }, (p: P) => {
        const row = noteRowFromRecord(p.new);
        if (row) h.onEvent({ type: "note", note: row });
      })
      .on("postgres_changes", { event: "*", schema: s, table: "locations", filter: f }, () =>
        h.onEvent({ type: "location" }),
      )
      .subscribe();
    // Altro canale a parte: i giochi (solo lo stato pubblico di `games`; i segreti non passano mai di qui).
    let gameCh: RealtimeChannel | null = this.client.channel(
      `games-${coupleId}-${Math.random().toString(36).slice(2, 8)}`,
    );
    gameCh
      .on("postgres_changes", { event: "*", schema: s, table: "games", filter: f }, (p: P) => {
        const game = gameFromRecord(p.new);
        if (game) h.onEvent({ type: "game", game });
      })
      .subscribe();
    // Altro canale a parte (sessione 7): eventi, domanda (solo "ha risposto", mai il testo), ricordi. Il telefono rilegge.
    let extraCh: RealtimeChannel | null = this.client.channel(
      `extra-${coupleId}-${Math.random().toString(36).slice(2, 8)}`,
    );
    extraCh
      .on("postgres_changes", { event: "*", schema: s, table: "countdown_events", filter: f }, () => h.onEvent({ type: "extra", what: "events" }))
      .on("postgres_changes", { event: "*", schema: s, table: "qa_answers", filter: f }, () => h.onEvent({ type: "extra", what: "qa" }))
      .on("postgres_changes", { event: "*", schema: s, table: "qa_days", filter: f }, () => h.onEvent({ type: "extra", what: "qa" }))
      .on("postgres_changes", { event: "*", schema: s, table: "memories", filter: f }, () => h.onEvent({ type: "extra", what: "memories" }))
      .subscribe();
    return () => {
      const xc = extraCh;
      extraCh = null;
      if (xc) void this.client.removeChannel(xc);
      const c = ch;
      const pc = petCh;
      const bc = boardCh;
      const gc = gameCh;
      gameCh = null;
      ch = null;
      petCh = null;
      boardCh = null;
      if (c) void this.client.removeChannel(c);
      if (pc) void this.client.removeChannel(pc);
      if (bc) void this.client.removeChannel(bc);
      if (gc) void this.client.removeChannel(gc);
    };
  }
}
