import { addDaysIso } from "@/lib/time";

import type { ZOp, ZSnapshot } from "./types";

/**
 * Vista ottimistica: la fotografia del server con sopra le operazioni ancora in coda (offline o in volo).
 * Non decide niente di segreto: i match e il risultato di "stasera?" arrivano SOLO dal server.
 */
export function replayZone(snap: ZSnapshot, queue: readonly ZOp[], me: { role: "a" | "b" | null }, now: number): ZSnapshot {
  let s: ZSnapshot = { ...snap, entries: [...snap.entries], customIdeas: [...snap.customIdeas], wishesMine: [...snap.wishesMine], vouchers: [...snap.vouchers] };
  for (const op of queue) {
    switch (op.kind) {
      case "log": {
        const row = { id: op.id, day: op.day, at: op.at, place: op.place, starter: op.starter, rating: op.rating, note: op.note?.trim() || null, by: me.role, updatedAt: now };
        const i = s.entries.findIndex((e) => e.id === op.id);
        if (i >= 0) s.entries[i] = { ...row, by: s.entries[i]!.by };
        else s.entries.push(row);
        break;
      }
      case "logDelete":
        s.entries = s.entries.filter((e) => e.id !== op.id);
        break;
      case "wish":
        s.wishesMine = op.on ? [...new Set([...s.wishesMine, op.idea])] : s.wishesMine.filter((w) => w !== op.idea);
        break;
      case "ideaAdd":
        if (!s.customIdeas.some((i) => i.id === `c-${op.id}`)) s.customIdeas.push({ id: `c-${op.id}`, text: op.text.trim(), level: op.level, mine: true });
        s.wishesMine = [...new Set([...s.wishesMine, `c-${op.id}`])];
        break;
      case "ideaDelete":
        s.customIdeas = s.customIdeas.filter((i) => !(i.id === `c-${op.id}` && i.mine));
        s.wishesMine = s.wishesMine.filter((w) => w !== `c-${op.id}`);
        break;
      case "tonight":
        if (s.tonight.result === null) s = { ...s, tonight: { ...s.tonight, mine: op.answer } };
        break;
      case "signal":
        s = { ...s, signal: { ...s.signal, mine: { level: op.level, at: now, expiresAt: now + (op.level === 1 ? 6 : op.level === 2 ? 4 : 1) * 3_600_000 } } };
        break;
      case "signalClear":
        s = { ...s, signal: { ...s.signal, mine: null } };
        break;
      case "voucherAdd":
        if (!s.vouchers.some((v) => v.id === op.id)) s.vouchers.push({ id: op.id, title: op.title.trim(), expires: op.expires, redeemedAt: null, createdAt: now, fromMe: true });
        break;
      case "voucherRedeem":
        s.vouchers = s.vouchers.map((v) => (v.id === op.id && v.redeemedAt === null ? { ...v, redeemedAt: now } : v));
        break;
      case "voucherDelete":
        s.vouchers = s.vouchers.filter((v) => v.id !== op.id);
        break;
      case "wipe":
        s = { ...s, entries: [], customIdeas: [], wishesMine: [], matches: [], vouchers: [], tonight: { ...s.tonight, mine: null, otherAnswered: false, result: null }, signal: { incoming: null, mine: null } };
        break;
    }
  }
  return s;
}

/** Il giorno più vecchio che il calendario accetta (10 anni indietro) e il più recente (domani, per i fusi). */
export const zoneDayRange = (today: string) => ({ min: addDaysIso(today, -3650), max: addDaysIso(today, 1) });
