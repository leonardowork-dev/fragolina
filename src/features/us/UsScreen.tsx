import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";

import {
  Avatar,
  Button,
  Icon,
  Sticker,
  StickerPressable,
  StickerSwitch,
  Text,
  useTheme,
  useToast,
} from "@/design";
import { Screen } from "@/design/layout/Screen";
import { LinkBadge } from "@/features/pairing/LinkBadge";
import { PairingPanel } from "@/features/pairing/PairingPanel";
import { S } from "@/lib/strings.it";
import { daysSince, formatLongDate } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

import { EditCoupleSheet } from "./EditCoupleSheet";

/** Noi: la coppia (nomi, data) come adesivo grande, poi le impostazioni come righe di un secondo adesivo. */
export function UsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const me = useCouple((s) => s.meName);
  const partner = useCouple((s) => s.partnerName);
  const start = useCouple((s) => s.startDate);
  const haptics = useSettings((s) => s.haptics);
  const setHaptics = useSettings((s) => s.setHaptics);
  const reduce = useSettings((s) => s.reduceMotionOverride);
  const setReduce = useSettings((s) => s.setReduceMotionOverride);
  const setOnboardingDone = useSettings((s) => s.setOnboardingDone);
  const [edit, setEdit] = useState(false);
  const sessionLost = useCouple((s) => s.sessionLost);
  const dismissLost = useCouple((s) => s.dismissSessionLost);
  const days = daysSince(start);
  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Text variant="display" accessibilityRole="header">
          {S.us.title}
        </Text>
        <LinkBadge />
      </View>
      {sessionLost ? (
        <Sticker
          id="sessione-persa"
          fill={colors.butter}
          radius={24}
          offset={4}
          padding={16}
          tiltMax={1}
        >
          <View style={{ gap: 10 }}>
            <Text variant="title" accessibilityRole="header">
              {S.pairing.sessionLostTitle}
            </Text>
            <Text variant="body">{S.pairing.sessionLostBody(partner)}</Text>
            <Button label={S.pairing.sessionLostOk} variant="secondary" onPress={dismissLost} />
          </View>
        </Sticker>
      ) : null}
      <Sticker id="coppia" fill={colors.blush} radius={32} offset={6} padding={20} tiltMax={1.2}>
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row" }}>
            <Avatar name={me} size={64} fill={colors.butter} />
            <View style={{ marginLeft: -14, marginTop: 10 }}>
              <Avatar name={partner} size={64} fill={colors.sky} />
            </View>
          </View>
          <View accessible accessibilityLabel={`${me} e ${partner}`}>
            <Text variant="display" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {me}
            </Text>
            <Text variant="display" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
              {`e ${partner}`}
            </Text>
          </View>
          <Text variant="bodyStrong">
            {start
              ? `${S.us.since} ${formatLongDate(start)}${days > 0 ? ` · ${days} giorni` : ""}`
              : S.us.noDate}
          </Text>
          <Button label={S.us.edit} variant="secondary" icon="draw" onPress={() => setEdit(true)} />
        </View>
      </Sticker>

      <Sticker
        id="posto"
        fill={colors.surface}
        radius={28}
        offset={4}
        padding={18}
        tiltMax={0.8}
        style={{ marginRight: 14 }}
      >
        <View style={{ gap: 14 }}>
          <Text variant="title" accessibilityRole="header">
            {S.pairing.connectedTitle}
          </Text>
          <PairingPanel variant="us" />
        </View>
      </Sticker>

      <Sticker
        id="impostazioni"
        fill={colors.surface}
        radius={28}
        offset={4}
        padding={18}
        tiltMax={0.8}
        style={{ marginRight: 14 }}
      >
        <View style={{ gap: 18 }}>
          <Text variant="title" accessibilityRole="header">
            {S.us.settings}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.us.haptics}</Text>
              <Text variant="caption">{S.us.hapticsHint}</Text>
            </View>
            <StickerSwitch value={haptics} onChange={setHaptics} label={S.us.haptics} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.us.reduceMotion}</Text>
              <Text variant="caption">{S.us.reduceMotionHint}</Text>
            </View>
            <StickerSwitch
              value={reduce === true}
              onChange={(v) => setReduce(v ? true : null)}
              label={S.us.reduceMotion}
            />
          </View>
          <StickerPressable
            accessibilityLabel={S.us.replayIntro}
            haptic="light"
            onPress={() => {
              setOnboardingDone(false);
              router.replace("/onboarding");
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.us.replayIntro}</Text>
              <Text variant="caption">{S.us.replayIntroHint}</Text>
            </View>
            <Icon name="heart" size={26} fill={colors.blush} />
          </StickerPressable>
          <Text variant="caption">
            {S.appName} · {S.us.version} {version}
          </Text>
        </View>
      </Sticker>

      <EditCoupleSheet
        visible={edit}
        onClose={() => setEdit(false)}
        onSaved={() => toast.show(S.toast.saved)}
      />
    </Screen>
  );
}
