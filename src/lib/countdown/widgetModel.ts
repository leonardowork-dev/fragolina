import { shortDateYmd } from "@/lib/recurrence";

import { isEventIcon } from "./icons";
import { type CountdownEvent, type CountdownView, countdownView, isValidDate, minutesOf, pickCountdown } from "./rules";

/** Cosa mostra il widget. Specchio di `FragolinaEntry.countdown` in Model.swift (parità provata su migliaia di casi). */
export type CountdownDisplay = {
  id: string;
  title: string;
  icon: string;
  /** "20 dic · 18:30" oppure "20 dic" */
  dateLine: string;
  view: CountdownView;
};

type WidgetEvent = Pick<CountdownEvent, "id" | "title" | "date" | "time" | "icon" | "featured">;

/** Gli eventi dal JSON del feed (`events`). `null` se la risposta non ha l'elenco (server vecchio): allora vale lo snapshot. */
export function feedEventsFromJson(raw: unknown): WidgetEvent[] | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  if (j.ok !== true || !Array.isArray(j.events)) return null;
  const out: WidgetEvent[] = [];
  for (const x of j.events) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.title !== "string" || typeof o.date !== "string" || !isValidDate(o.date)) continue;
    out.push({
      id: o.id,
      title: o.title,
      date: o.date,
      time: typeof o.time === "string" && minutesOf(o.time) !== null ? o.time : null,
      icon: isEventIcon(o.icon) ? o.icon : "star",
      featured: o.featured === true,
    });
  }
  return out;
}

/** Il feed, se c'è e ha gli eventi, ha l'ultima parola; altrimenti lo snapshot dell'app. Token revocato: niente. */
export function eventsForWidget(snapshot: readonly WidgetEvent[], feed: readonly WidgetEvent[] | null, revoked: boolean): readonly WidgetEvent[] {
  if (revoked) return [];
  return feed ?? snapshot;
}

export function countdownDisplay(events: readonly WidgetEvent[], today: string, nowMin: number): CountdownDisplay | null {
  const full = events.map((e) => ({ ...e, at: 0 }));
  const e = pickCountdown(full, today, nowMin);
  if (!e) return null;
  const when = shortDateYmd(e.date) + (minutesOf(e.time) !== null ? ` · ${e.time}` : "");
  return { id: e.id, title: e.title || "Un evento", icon: e.icon, dateLine: when, view: countdownView(e, today, nowMin) };
}
