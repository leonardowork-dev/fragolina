import * as Location from "expo-location";
import { Platform } from "react-native";

import { roundE2 } from "@/lib/geo/distance";

/**
 * Posizione per la distanza. SOLO posizioni arrotondate (centesimi di grado ≈ 1 km) escono da qui: il resto
 * dell'app non vede mai le coordinate vere. Permesso "Mentre usi l'app" per l'aggiornamento normale; "Sempre"
 * (facoltativo, solo iOS) per aggiornare anche ad app chiusa quando ti sposti molto.
 */
export type LocPerm = "undetermined" | "denied" | "when" | "always";

export async function getPerm(): Promise<LocPerm> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) return fg.canAskAgain === false || fg.status === "denied" ? "denied" : "undetermined";
    if (Platform.OS === "ios") {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.granted) return "always";
    }
    return "when";
  } catch {
    return "undetermined";
  }
}

export async function askWhenInUse(): Promise<LocPerm> {
  try {
    await Location.requestForegroundPermissionsAsync();
  } catch {
    /* il sistema ha rifiutato di chiedere */
  }
  return getPerm();
}

export async function askAlways(): Promise<LocPerm> {
  try {
    await Location.requestBackgroundPermissionsAsync();
  } catch {
    /* idem */
  }
  return getPerm();
}

export type Rounded = { latE2: number; lonE2: number };

/** La posizione di adesso, già arrotondata (accuratezza bassa: basta ~1 km e risparmia batteria). `null` se non si riesce. */
export async function currentRounded(): Promise<Rounded | null> {
  try {
    const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return { latE2: roundE2(l.coords.latitude), lonE2: roundE2(l.coords.longitude) };
  } catch {
    return null;
  }
}

export const LOCATION_TASK = "fragolina-location";

/** Aggiornamento ad app chiusa (iOS, permesso "Sempre"): iOS risveglia l'app quando ti sposti di molto (~500 m). */
export async function startBackground(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Low,
      distanceInterval: 3000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: false,
      activityType: Location.ActivityType.Other,
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackground(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    /* già fermo */
  }
}
