import { BackendError, type QueuedOp } from "./types";

export const MAX_QUEUED_PINGS = 200;
export const MAX_QUEUED_PET = 100;

/**
 * Accoda un'operazione. Regole:
 *  - umore e data d'inizio sono last-write-wins: ne resta una sola in coda (l'ultima), che conserva il `prev`
 *    della PRIMA (per il rollback giusto);
 *  - la risposta del giorno è immutabile: una sola per giorno (resta la prima);
 *  - i "penso a te" sono append-only: restano tutti, fino a MAX_QUEUED_PINGS (poi cadono i più vecchi);
 *  - stesso `key` già in coda: ignorato (idempotenza).
 */
export function enqueue(queue: QueuedOp[], op: QueuedOp): QueuedOp[] {
  if (queue.some((q) => q.key === op.key)) return queue;
  let next = queue;
  if (op.kind === "petName") next = next.filter((q) => q.kind !== "petName"); // last-write-wins: resta l'ultimo
  if (op.kind === "mood" || op.kind === "startDate" || op.kind === "name") {
    const prior = next.filter((q) => q.kind === op.kind);
    next = next.filter((q) => q.kind !== op.kind);
    const first = prior[0];
    if (first && first.kind === op.kind && "prev" in first && "prev" in op) {
      op = { ...op, prev: first.prev } as QueuedOp;
    }
  }
  if (op.kind === "answer") {
    if (next.some((q) => q.kind === "answer" && q.day === op.day)) return next;
  }
  next = [...next, op];
  if (op.kind === "ping") {
    const pings = next.filter((q) => q.kind === "ping");
    if (pings.length > MAX_QUEUED_PINGS) {
      const drop = new Set(pings.slice(0, pings.length - MAX_QUEUED_PINGS).map((q) => q.key));
      next = next.filter((q) => !drop.has(q.key));
    }
  }
  if (op.kind === "pet") {
    const pets = next.filter((q) => q.kind === "pet");
    if (pets.length > MAX_QUEUED_PET) {
      const drop = new Set(pets.slice(0, pets.length - MAX_QUEUED_PET).map((q) => q.key));
      next = next.filter((q) => !drop.has(q.key));
    }
  }
  return next;
}

export type FlushResult = {
  /** Operazioni ancora da fare (in ordine). */
  remaining: QueuedOp[];
  /** Eseguite con successo, in ordine. */
  done: QueuedOp[];
  /** Rifiutate in modo definitivo dal server (da annullare con il rollback). */
  rejected: { op: QueuedOp; error: BackendError }[];
  /** Perché ci si è fermati prima della fine (null = coda svuotata). */
  stoppedBy: "network" | "session" | "rate_limited" | null;
};

/**
 * Esegue la coda IN ORDINE, una alla volta. Si ferma al primo errore ritentabile (rete, sessione, limite) senza
 * perdere nulla; un rifiuto definitivo (es. chiave non valida) scarta solo quell'operazione.
 */
export async function flushQueue(
  queue: QueuedOp[],
  exec: (op: QueuedOp) => Promise<void>,
  isAborted: () => boolean = () => false,
): Promise<FlushResult> {
  const done: QueuedOp[] = [];
  const rejected: FlushResult["rejected"] = [];
  let i = 0;
  let stoppedBy: FlushResult["stoppedBy"] = null;
  const rest: QueuedOp[] = [];
  for (; i < queue.length; i++) {
    if (isAborted()) {
      stoppedBy = "network";
      break;
    }
    const op = queue[i];
    try {
      await exec(op);
      done.push(op);
    } catch (e) {
      const err = e instanceof BackendError ? e : new BackendError("unknown", String(e));
      if (err.kind === "network" || err.kind === "session" || err.kind === "rate_limited") {
        stoppedBy = err.kind;
        rest.push({ ...op, attempts: op.attempts + 1 });
        i++;
        break;
      }
      rejected.push({ op, error: err });
    }
  }
  return { remaining: [...rest, ...queue.slice(i)], done, rejected, stoppedBy };
}
