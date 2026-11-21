import React from "react";
import { View } from "react-native";

import { Sticker, Text, useTheme } from "@/design";
import { expiryView } from "@/lib/expiry";
import { S } from "@/lib/strings.it";
import { useExpiry } from "@/state/expiryStore";

import { openRenewGuide } from "./ExpiryCard";

/** In Home: un adesivo gentile SOLO quando mancano al massimo 2 giorni alla scadenza. Tocco = guida al rinnovo. */
export function RenewNudge() {
  const { colors } = useTheme();
  const mine = useExpiry((s) => s.mine);
  const readAt = useExpiry((s) => s.readAt);
  const v = expiryView(mine, readAt);
  if (v.state !== "soon" && v.state !== "last") return null;
  return (
    <Sticker
      id="rinnova"
      fill={colors.butter}
      radius={22}
      offset={4}
      padding={14}
      tiltMax={1.2}
      haptic="light"
      onPress={openRenewGuide}
      accessibilityLabel={S.expiry.guideLabel}
    >
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong">{S.expiry.nudge(v.days)}</Text>
        <Text variant="caption">{S.expiry.nudgeSub}</Text>
      </View>
    </Sticker>
  );
}
