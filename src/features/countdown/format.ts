import { S } from "@/lib/strings.it";
import type { CountdownView } from "@/lib/countdown/rules";

/** "tra 12 giorni", "domani", "tra 5 ore", "oggi", "adesso" */
export function whenText(v: CountdownView): string {
  switch (v.state) {
    case "days":
      return S.countdown.inDays(v.daysUntil);
    case "hours":
      return S.countdown.inHours(Number(v.big));
    case "minutes":
      return S.countdown.inMinutes(Number(v.big));
    case "today":
      return S.countdown.today;
    case "now":
      return S.countdown.now;
    default:
      return "";
  }
}

export const unitText = (v: CountdownView): string =>
  v.state === "days" ? S.countdown.unitDays(v.daysUntil) : v.state === "hours" ? S.countdown.unitHours(Number(v.big)) : v.state === "minutes" ? S.countdown.unitMinutes : "";

export const isParty = (v: CountdownView) => v.state === "today" || v.state === "now";
