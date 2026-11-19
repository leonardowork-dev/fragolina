import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Icon, Sticker, Text, useTheme } from "@/design";
import { radius } from "@/design/tokens";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

import { useQa } from "./useQa";

/** In Home: la domanda del giorno (compatta). Tocco = pagina della domanda, dove si risponde e si leggono le risposte. */
export function QaCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const partner = useCouple((s) => s.partnerName);
  const { day, text } = useQa();
  const mine = !!day.mine;
  const both = mine && !!day.theirs;
  const status = both ? S.qa.ready : mine ? S.qa.waiting(partner) : day.theirsAnswered ? S.qa.partnerDone(partner) : S.qa.open;
  return (
    <Sticker
      id="domanda"
      fill={both ? colors.butter : colors.surface}
      radius={radius.lg}
      offset={4}
      padding={18}
      tiltMax={1}
      onPress={() => router.push("/question")}
      haptic="light"
      style={{ marginRight: 14 }}
      accessibilityLabel={`${S.qa.cardTitle}: ${text}. ${status}`}
    >
      <View style={{ gap: 10 }}>
        <Text variant="caption">{S.qa.cardTitle}</Text>
        <Text variant="title" testID="qa-card-text">
          {text}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: both ? colors.leaf : mine ? colors.skySoft : colors.accent,
              borderWidth: 2.5,
              borderColor: colors.outline,
            }}
          >
            <Text variant="caption" testID="qa-card-status">
              {status}
            </Text>
          </View>
          {both ? <Text variant="caption">{S.qa.readyBody}</Text> : null}
          <View style={{ flex: 1 }} />
          <Icon name="forward" size={22} />
        </View>
      </View>
    </Sticker>
  );
}
