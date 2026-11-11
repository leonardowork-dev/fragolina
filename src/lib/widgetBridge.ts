import { Platform } from "react-native";

import { getGroupResolver } from "../../modules/group-resolver";
import { WIDGET_SCHEMA_VERSION } from "@/config/couple";

/**
 * Ponte app → widget. L'UI parla SOLO con `widgetBridge` (interfaccia `WidgetBridge`).
 * PERCORSO A (oggi): scrive un JSON nell'App Group (gruppo scelto a runtime) e chiede il reload delle timeline.
 * PERCORSO B (fallback, vedi docs/RESEARCH.md): basta una nuova classe che implementa `WidgetBridge` e invia lo
 * stato al server (Supabase) invece che al container; il widget allora fa fetch da solo. Nessuna modifica alla UI.
 * Il widget gira in un processo isolato: riceve solo dati già calcolati, mai stato dell'app.
 */
export type WidgetSnapshot = {
  v: number;
  updatedAt: number; // ms epoch
  partnerName: string;
  moodId: string;
  moodLabel: string;
  thinkingToday: number;
  startDate: string; // AAAA-MM-GG: i giorni li calcola il widget (scattano a mezzanotte da soli)
};

export type PushResult =
  | { ok: true; group: string }
  | { ok: false; reason: string };

export type BridgeDiagnostics = {
  bridge: string;
  available: boolean;
  resolvedGroup: string | null;
  candidates: string[];
  roundTripOk: boolean | null;
};

export interface WidgetBridge {
  readonly name: string;
  isAvailable(): boolean;
  push(snapshot: WidgetSnapshot): PushResult;
  diagnostics(): BridgeDiagnostics;
}

export function makeSnapshot(input: Omit<WidgetSnapshot, "v" | "updatedAt">): WidgetSnapshot {
  return { v: WIDGET_SCHEMA_VERSION, updatedAt: Date.now(), ...input };
}

/** Percorso A: App Group condiviso. */
class AppGroupBridge implements WidgetBridge {
  readonly name = "app-group";

  isAvailable() {
    return Platform.OS === "ios" && getGroupResolver() !== null;
  }

  push(snapshot: WidgetSnapshot): PushResult {
    const native = getGroupResolver();
    if (!native) return { ok: false, reason: "modulo nativo assente (Expo Go o web)" };
    try {
      const group = native.writePayload(JSON.stringify(snapshot));
      if (!group) return { ok: false, reason: "nessun App Group utilizzabile (container negato dal sistema)" };
      native.reloadWidgets();
      return { ok: true, group };
    } catch (e) {
      return { ok: false, reason: String(e) };
    }
  }

  diagnostics(): BridgeDiagnostics {
    const native = getGroupResolver();
    if (!native) return { bridge: this.name, available: false, resolvedGroup: null, candidates: [], roundTripOk: null };
    let roundTripOk: boolean | null = null;
    try {
      roundTripOk = native.resolveGroupId() ? native.readPayload() !== null : false;
    } catch {
      roundTripOk = false;
    }
    return {
      bridge: this.name,
      available: true,
      resolvedGroup: native.resolveGroupId(),
      candidates: native.candidates(),
      roundTripOk,
    };
  }
}

/** Web / Expo Go: non fa nulla. */
class NoopBridge implements WidgetBridge {
  readonly name = "noop";
  isAvailable() {
    return false;
  }
  push(): PushResult {
    return { ok: false, reason: "widget non disponibili su questa piattaforma" };
  }
  diagnostics(): BridgeDiagnostics {
    return { bridge: this.name, available: false, resolvedGroup: null, candidates: [], roundTripOk: null };
  }
}

export const widgetBridge: WidgetBridge = Platform.OS === "ios" ? new AppGroupBridge() : new NoopBridge();
