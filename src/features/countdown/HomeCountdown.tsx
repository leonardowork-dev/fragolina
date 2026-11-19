import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";

import { Sticker, Text, useEffectsBus, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

import { EventIcon } from "./EventIcon";
import { isParty, unitText, whenText } from "./format";
import { useCountdown } from "./useCountdown";

const celebrated = new Set<string>();

/** In Home: il prossimo evento ("tra 12 giorni: Ci vediamo"). Se non c'è nessun evento non compare (niente rumore). Il giorno dell'evento: festa, una volta. */
export function HomeCountdown() {
  const { colors } = useTheme();
  const router = useRouter();
  const paired = useCouple((s) => s.members.length >= 2);
  const { picked, viewOf, today } = useCountdown();
  const v = picked ? viewOf(picked) : null;
  const party = !!v && isParty(v);
  const key = picked ? `${picked.id}|${today}` : "";
  useEffect(() => {
    if (party && key && !celebrated.has(key)) {
      celebrated.add(key);
      useEffectsBus.getState().fireConfetti();
    }
  }, [party, key]);
  if (!paired || !picked || !v) return null;
  return (
    <Sticker
      id="home-countdown"
      fill={party ? colors.accent : colors.sky}
      radius={28}
      offset={5}
      padding={14}
      tiltMax={1.6}
      onPress={() => router.push("/countdown")}
      haptic="light"
      accessibilityLabel={`${S.countdown.homeTitle}. ${S.countdown.a11yEvent(picked.title, whenText(v))}. ${S.countdown.open}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <EventIcon id={picked.icon} size={52} />
        <View style={{ flex: 1 }}>
          <Text variant="caption">{party ? S.countdown.partyLine : S.countdown.homeTitle}</Text>
          <Text variant="title" numberOfLines={2} testID="home-countdown-line">
            {S.countdown.homeLine(whenText(v), picked.title)}
          </Text>
        </View>
        {!party ? (
          <View style={{ alignItems: "center", minWidth: 56 }}>
            <Text variant="display" style={{ fontSize: 34, lineHeight: 36 }} numberOfLines={1}>
              {v.big}
            </Text>
            <Text variant="caption">{unitText(v)}</Text>
          </View>
        ) : null}
      </View>
    </Sticker>
  );
}
