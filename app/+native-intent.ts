import { systemPathFor } from "@/lib/deepLink";

/**
 * I link dei widget (`fragolina://ping`, `://mood`, `://us`, `://home`) non sono rotte: li traduciamo in una rotta
 * vera, così il router non mostra "non trovato". L'azione (il pensiero, la scelta dell'umore) la fa `useDeepLinks`.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return systemPathFor(path) ?? path;
  } catch {
    return path;
  }
}
