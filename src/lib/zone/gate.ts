/** Dopo quanto tempo in background (o senza usare la zona) si richiude: 1 minuto. */
export const RELOCK_MS = 60_000;

/** Vero se la zona va richiusa: è passato più di un minuto dall'ultima volta che era in primo piano. */
export const shouldRelock = (lastActiveAt: number | null, now: number): boolean => lastActiveAt === null || now - lastActiveAt > RELOCK_MS;

export const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin);

/** Il gesto segreto: 3 tocchi rapidi sul cuore in Noi (entro 1,2 s l'uno dall'altro). */
export const GESTURE_TAPS = 3;
export const GESTURE_GAP_MS = 1200;

/** Conta i tocchi consecutivi: ritorna il nuovo contatore (riparte da 1 se è passato troppo tempo). */
export function nextTapCount(prevCount: number, prevAt: number, now: number): number {
  return now - prevAt <= GESTURE_GAP_MS ? prevCount + 1 : 1;
}
