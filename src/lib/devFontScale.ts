import { Platform } from "react-native";

/**
 * Solo per le prove nel browser: `?fontScale=1.5` simula "Testo grande" di iOS (Dynamic Type) moltiplicando i corpi dei
 * testi, rispettando `maxFontSizeMultiplier` come fa React Native sul telefono. Sul telefono non fa nulla (ci pensa iOS).
 */
let cached: number | null = null;
export function devFontScale(): number {
  if (Platform.OS !== "web") return 1;
  if (cached !== null) return cached;
  let v = 1;
  try {
    const q = new URLSearchParams(window.location.search).get("fontScale");
    const n = q ? Number(q) : 1;
    if (Number.isFinite(n) && n >= 1 && n <= 3.2) v = n;
  } catch {
    /* niente */
  }
  cached = v;
  return v;
}
