import React from "react";
import { Linking, View } from "react-native";

import { Button, Sticker, Text, useTheme } from "@/design";
import { expiryView } from "@/lib/expiry";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";
import { useExpiry } from "@/state/expiryStore";

/** Apre la guida al rinnovo (pagina pubblica del repository). Non lancia mai. */
export function openRenewGuide() {
  Linking.openURL(S.expiry.guideUrl).catch(() => {});
}

/** In "Noi": quando scade Fragolina sul MIO telefono e (se l'ha scritto) sul suo. Nascosta se non si legge nulla (web). */
export function ExpiryCard() {
  const { colors } = useTheme();
  const mine = useExpiry((s) => s.mine);
  const partner = useExpiry((s) => s.partner);
  const paired = useCouple((s) => !!s.coupleId && s.members.length >= 2);
  const now = useExpiry((s) => s.readAt);
  const mv = expiryView(mine, now);
  const pv = paired && partner ? expiryView(partner.expiresAt, now) : null;
  if (mv.state === "none" && (!pv || pv.state === "none")) return null;
  const urgent = mv.state === "soon" || mv.state === "last" || mv.state === "expired";
  return (
    <Sticker
      id="rinnovo"
      fill={urgent ? colors.butter : colors.surface}
      radius={28}
      offset={4}
      padding={18}
      tiltMax={0.8}
      style={{ marginRight: 14 }}
    >
      <View style={{ gap: 8 }}>
        <Text variant="title" accessibilityRole="header">
          {S.expiry.title}
        </Text>
        {mv.state !== "none" ? <Text variant="bodyStrong">{S.expiry.mine(mv)}</Text> : null}
        {pv && partner && pv.state !== "none" ? (
          <Text variant="body">{S.expiry.partner(partner.name, pv)}</Text>
        ) : null}
        <Text variant="caption">{S.expiry.hint}</Text>
        <Button
          label={S.expiry.guide}
          variant="secondary"
          onPress={openRenewGuide}
        />
      </View>
    </Sticker>
  );
}
