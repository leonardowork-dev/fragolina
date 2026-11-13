import type * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { widgetFeedBase } from "@/lib/backend";
import { roundE2 } from "@/lib/geo/distance";
import { writeWidgetSnapshot } from "@/features/widgetSync/writeSnapshot";
import { useCouple } from "@/state/coupleStore";

import { LOCATION_TASK } from "./locationApi";

/**
 * Compito in background (iOS, permesso "Sempre"): iOS risveglia l'app quando ti sposti molto; qui si arrotonda la
 * posizione e la si manda con il TOKEN DEL WIDGET (`widget_set_location`: niente sessione, perché a telefono bloccato
 * il portachiavi dell'app può non essere leggibile). Poi si riscrive lo snapshot (la mia posizione per il widget) e si
 * ricaricano i widget. Va definito a livello di modulo (app/_layout.tsx lo importa).
 */
async function hydrated(): Promise<void> {
  if (useCouple.getState().hydrated) return;
  await new Promise<void>((done) => {
    const t = setTimeout(done, 5000);
    const off = useCouple.subscribe((s) => {
      if (s.hydrated) {
        clearTimeout(t);
        off();
        done();
      }
    });
  });
}

export async function handleLocations(locations: Location.LocationObject[]): Promise<void> {
  const last = locations[locations.length - 1];
  if (!last) return;
  await hydrated();
  const st = useCouple.getState();
  const base = widgetFeedBase();
  if (!st.loc.sharing || !st.widgetToken || !base) return;
  const p = { latE2: roundE2(last.coords.latitude), lonE2: roundE2(last.coords.longitude) };
  const at = Date.now();
  const me = st.loc.me;
  if (me && me.latE2 === p.latE2 && me.lonE2 === p.lonE2 && at - me.at < 15 * 60_000) return;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${base.url.replace(/\/+$/, "")}/rest/v1/rpc/widget_set_location`, {
      method: "POST",
      headers: {
        apikey: base.key,
        ...(base.key.startsWith("eyJ") ? { Authorization: `Bearer ${base.key}` } : null),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: st.widgetToken, p_lat_e2: p.latE2, p_lon_e2: p.lonE2, p_at: at }),
      signal: ctl.signal,
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!res.ok || !j?.ok) return;
    useCouple.setState({ loc: { ...useCouple.getState().loc, me: { ...p, at } } });
    writeWidgetSnapshot(true);
  } catch {
    /* niente rete: al prossimo spostamento */
  } finally {
    clearTimeout(timer);
  }
}

if (Platform.OS === "ios") {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    if (locations?.length) await handleLocations(locations);
  });
}
