/**
 * Raggruppa le richieste "aggiorna il widget" (debounce con attesa massima) così iOS non vede decine di
 * `reloadAllTimelines` in pochi secondi (ogni ricarica consuma budget). Funzioni pure con timer iniettabili:
 * provate in tests/pushScheduler.test.ts.
 *
 * - `notify()`: qualcosa è cambiato; scrive dopo `debounceMs` di quiete, ma al più dopo `maxWaitMs` dal primo avviso.
 * - `flushNow(force)`: scrive subito (app che va in secondo piano); annulla l'attesa.
 * - `dispose()`: annulla tutto.
 */
export type PushSchedulerOptions = {
  debounceMs: number;
  maxWaitMs: number;
  run: (force: boolean) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
};

export function createPushScheduler(o: PushSchedulerOptions) {
  const now = o.now ?? Date.now;
  const setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let burstStart: number | null = null;
  let pendingForce = false;

  const fire = () => {
    timer = null;
    burstStart = null;
    const f = pendingForce;
    pendingForce = false;
    o.run(f);
  };

  return {
    notify(force = false) {
      pendingForce = pendingForce || force;
      const t = now();
      if (burstStart === null) burstStart = t;
      if (timer !== null) clearTimer(timer);
      const wait = Math.max(0, Math.min(o.debounceMs, burstStart + o.maxWaitMs - t));
      timer = setTimer(fire, wait);
    },
    flushNow(force = true) {
      if (timer !== null) clearTimer(timer);
      timer = null;
      burstStart = null;
      pendingForce = false;
      o.run(force);
    },
    dispose() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    get pending() {
      return timer !== null;
    },
  };
}
