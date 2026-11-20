import { S } from "@/lib/strings.it";

/** Cosa dice l'unico badge di stato dell'app. `null` = niente (va tutto bene). Funzione pura, provata nei test. */
export function linkBadgeText(o: {
  link: string;
  queued: number;
  backendKind: string;
  serverDown: boolean;
}): { text: string; tone: "warn" | "info" } | null {
  if (o.serverDown && o.backendKind === "supabase") return { text: S.link.serverDown, tone: "warn" };
  if (o.link === "offline") return { text: o.queued > 0 ? S.link.offlineQueued(o.queued) : S.link.offline, tone: "warn" };
  if (o.queued > 0) return { text: S.link.queued(o.queued), tone: "info" };
  if (o.backendKind === "mock") return { text: S.link.mock, tone: "info" };
  return null;
}
