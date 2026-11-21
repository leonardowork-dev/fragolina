import React, { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";

import { Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { shouldRelock } from "@/lib/zone/gate";
import { useZone } from "@/state/zoneStore";

import { WinkStrawberry } from "./ZoneArt";

/**
 * Copertura neutra: quando l'app va in background (o nel selettore delle app) e la zona è aperta, tutto si copre con
 * una fragola che dorme su carta (niente blur). Al ritorno, se è passato più di 1 minuto, la zona si richiude.
 * Montare UNA volta nella radice, sopra tutto.
 */
export function ZoneCover() {
  const { colors } = useTheme();
  const unlocked = useZone((s) => s.unlocked);
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      const z = useZone.getState();
      if (st !== "active") {
        if (z.unlocked) {
          setCovered(true);
          z.touch();
        }
        return;
      }
      if (z.unlocked && shouldRelock(z.lastActiveAt, Date.now())) z.lock();
      setCovered(false);
    });
    return () => sub.remove();
  }, []);
  if (!unlocked || !covered) return null;
  return (
    <View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: colors.ground, alignItems: "center", justifyContent: "center", zIndex: 100 }]} accessibilityLabel={S.zone.coverTitle}>
      <WinkStrawberry size={120} wink={false} />
      <Text variant="title" style={{ marginTop: 12 }}>{S.zone.coverTitle}</Text>
    </View>
  );
}
