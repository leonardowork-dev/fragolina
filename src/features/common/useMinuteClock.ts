import { useEffect, useState } from "react";

/** Un orologio che batte ogni minuto (e al ritorno in primo piano): serve ai conti alla rovescia che cambiano da soli. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const ms = 60_000 - (Date.now() % 60_000) + 50;
    let iv: ReturnType<typeof setInterval> | null = null;
    const first = setTimeout(() => {
      tick();
      iv = setInterval(tick, 60_000);
    }, ms);
    return () => {
      clearTimeout(first);
      if (iv) clearInterval(iv);
    };
  }, []);
  return now;
}
