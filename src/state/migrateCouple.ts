/**
 * Migrazione dello stato persistito della coppia. v2 = fino alla sessione 7; v3 = sessione 8 (stesso formato, ma lo
 * stato letto dal disco viene ripulito: un valore del tipo sbagliato, o una voce di coda rotta, non deve mai far
 * crollare l'app all'avvio né far perdere il resto). I campi che mancano (stati vecchi) ricevono i valori iniziali
 * dallo store (zustand unisce lo stato salvato a quello iniziale).
 */
export const COUPLE_VERSION = 3;

const ARRAYS = ["queue", "petLog", "eventsServer", "memoriesServer", "gamesServer", "members"] as const;
const OBJECTS = ["gameScores", "gameDecks", "gameMine", "loc"] as const;
const NULLABLE_OBJECTS = ["petServer", "noteServer", "qaServer", "petMyLast"] as const;
const STRINGS = ["meName", "partnerName", "startDate", "userId", "coupleId", "myRole", "joinCode", "widgetToken"] as const;
const NUMBERS = ["startDateAt", "lastSyncAt", "pingsSentToday", "pingsReceivedTotal"] as const;
const BOOLS = ["sessionLost"] as const;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function migrateCouple(persisted: unknown, _version?: number): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(persisted) ? { ...persisted } : {};
  for (const k of ARRAYS) if (k in out && !Array.isArray(out[k])) delete out[k];
  for (const k of OBJECTS) if (k in out && !isObj(out[k])) delete out[k];
  for (const k of NULLABLE_OBJECTS) if (k in out && out[k] !== null && !isObj(out[k])) delete out[k];
  for (const k of STRINGS) if (k in out && out[k] !== null && typeof out[k] !== "string") delete out[k];
  for (const k of NUMBERS) if (k in out && !(typeof out[k] === "number" && Number.isFinite(out[k]))) delete out[k];
  for (const k of BOOLS) if (k in out && typeof out[k] !== "boolean") delete out[k];
  if (Array.isArray(out.queue)) {
    out.queue = out.queue.filter(
      (q) => isObj(q) && typeof q.kind === "string" && typeof q.key === "string" && typeof q.at === "number",
    );
  }
  return out;
}
