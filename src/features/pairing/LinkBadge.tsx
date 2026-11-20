import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Sticker, Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";
import { useNet } from "@/state/netStore";

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

/**
 * UN SOLO badge di stato in tutta l'app (montato nella radice, sopra la barra delle tab): appare solo se serve
 * (senza rete, server che dorme, operazioni in attesa, prova locale). Mai quando va tutto bene. Non intercetta i tocchi.
 */
export function LinkBadge() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const link = useCouple((s) => s.link);
  const queued = useCouple((s) => s.queue.length);
  const backendKind = useCouple((s) => s.backendKind);
  const serverDown = useNet((s) => s.serverDown);
  const b = linkBadgeText({ link, queued, backendKind, serverDown });
  if (!b) return null;
  // sopra la barra delle tab (56 + 4 + margine); sulle pagine senza barra resta comunque vicino al fondo
  const bottom = Math.max(insets.bottom, 10) + 4 + 56 + 10;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", zIndex: 900 }}
    >
      <Sticker
        id="link-badge"
        fill={b.tone === "warn" ? colors.butter : colors.skySoft}
        radius={14}
        offset={2}
        padding={0}
        tiltMax={1.5}
        accessibilityRole="text"
        accessibilityLabel={b.text}
      >
        <Text
          variant="caption"
          style={{ paddingHorizontal: 10, paddingVertical: 5, fontSize: 14, lineHeight: 18 }}
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
        >
          {b.text}
        </Text>
      </Sticker>
    </View>
  );
}
