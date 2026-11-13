/**
 * Distanza fra due persone. Si scambiano SOLO coordinate arrotondate al centesimo di grado (≈ 1 km): interi
 * `latE2`/`lonE2` (gradi × 100). Funzioni PURE; specchio Swift in targets/widget/Model.swift (`haversineKm`,
 * `distanceTitle`), provato da tests/swiftParity.test.ts.
 */
export const EARTH_RADIUS_KM = 6371.0088;
/** Sotto questa distanza si dice "vicinissimi": con l'arrotondamento a ~1 km l'errore è ±1,5 km, quindi 0 e 1 km non si distinguono. */
export const NEAR_KM = 2;
export const LOC_STALE_MS = 3 * 60 * 60 * 1000;

export type LatLonE2 = { latE2: number; lonE2: number };

export function roundE2(deg: number): number {
  return Math.round(deg * 100);
}

export function validE2(p: LatLonE2): boolean {
  return (
    Number.isInteger(p.latE2) &&
    Number.isInteger(p.lonE2) &&
    p.latE2 >= -9000 &&
    p.latE2 <= 9000 &&
    p.lonE2 >= -18000 &&
    p.lonE2 <= 18000
  );
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLonE2, b: LatLonE2): number {
  const la1 = rad(a.latE2 / 100);
  const la2 = rad(b.latE2 / 100);
  const dLa = la2 - la1;
  const dLo = rad((b.lonE2 - a.lonE2) / 100);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLo / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "19.000" (punto delle migliaia all'italiana, senza usare il locale: stesso risultato ovunque). */
export function groupThousands(n: number): string {
  const s = String(Math.max(0, Math.round(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export type DistanceView = { near: boolean; km: number; big: string; unit: string; sentence: string };

export function distanceView(km: number): DistanceView {
  const k = Math.round(km);
  if (km < NEAR_KM) return { near: true, km: k, big: "0", unit: "km", sentence: "vicinissimi" };
  return { near: false, km: k, big: groupThousands(k), unit: "km", sentence: `a ${groupThousands(k)} km` };
}
