import Constants from "expo-constants";
import React, { useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";

import { Button, Sticker, Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { UPDATE_API, UPDATE_CHECK_EVERY_MS, type UpdateInfo, altStoreInstallUrl, isNewer, parseRelease, sideStoreInstallUrl } from "@/lib/update";

let lastCheck = 0;
let cached: UpdateInfo | null = null;

async function check(): Promise<UpdateInfo | null> {
  const now = Date.now();
  if (now - lastCheck < UPDATE_CHECK_EVERY_MS) return cached;
  lastCheck = now;
  try {
    const r = await fetch(UPDATE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (r.ok) cached = parseRelease(await r.json());
  } catch {
    /* senza rete: niente avviso */
  }
  return cached;
}

/** In Noi: "Aggiornamento disponibile (build N)" con un bottone che apre SideStore. Nessuna notifica push. */
export function UpdateCard() {
  const { colors } = useTheme();
  const mine = Number(Constants.platform?.ios?.buildNumber ?? (Constants.expoConfig?.extra as { buildNumber?: string } | undefined)?.buildNumber ?? 0);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => void check().then((i) => alive && setInfo(i));
    run();
    const sub = AppState.addEventListener("change", (st) => st === "active" && run());
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  if (!isNewer(info, mine) || !info) return null;
  const open = () => {
    void Linking.openURL(sideStoreInstallUrl(info.url)).catch(() => Linking.openURL(altStoreInstallUrl(info.url)).catch(() => {}));
  };
  return (
    <Sticker id="aggiornamento" fill={colors.butter} radius={28} offset={4} padding={18} tiltMax={0.8} style={{ marginRight: 14 }}>
      <View style={{ gap: 8 }}>
        <Text variant="title" accessibilityRole="header">{S.recovery.updateTitle}</Text>
        <Text variant="body">{S.recovery.updateBody(info.build)}</Text>
        <Button label={S.recovery.updateAction} onPress={open} />
        <Text variant="caption">{S.recovery.updateHint}</Text>
      </View>
    </Sticker>
  );
}
