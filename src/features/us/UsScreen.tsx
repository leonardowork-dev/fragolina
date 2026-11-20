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
import { DistanceCard } from "@/features/distance/DistanceCard";
import { PairingPanel } from "@/features/pairing/PairingPanel";
import { appVersionLabel } from "@/lib/appInfo";
import { S } from "@/lib/strings.it";
import { daysSince, formatLongDate } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";
import { useNet } from "@/state/netStore";
import { useSettings } from "@/state/settingsStore";

import { EditCoupleSheet } from "./EditCoupleSheet";

/** Le cose da fare insieme (sessione 7): conto alla rovescia, domanda del giorno, ricordi, il nostro mese. Più il passo manuale se manca. */
function TogetherLinks() {
  const { colors } = useTheme();
  const router = useRouter();
  const available = useCouple((s) => s.extraAvailable);
  const rows: { id: string; label: string; to: "/countdown" | "/question" | "/memories" | "/month"; fill: string }[] = [
    { id: "countdown", label: S.countdown.title, to: "/countdown", fill: colors.sky },
    { id: "question", label: S.qa.cardTitle, to: "/question", fill: colors.blush },
    { id: "memories", label: S.memories.title, to: "/memories", fill: colors.butter },
    { id: "month", label: S.month.title, to: "/month", fill: colors.leafSoft },
  ];
  return (
    <>
      {available === false ? (
        <Sticker id="step7" fill={colors.butterSoft} radius={24} offset={4} padding={16} tiltMax={1}>
          <View style={{ gap: 6 }}>
            <Text variant="title" accessibilityRole="header">
              {S.step7.title}
            </Text>
            <Text variant="body">{S.step7.body}</Text>
          </View>
        </Sticker>
      ) : null}
      <Sticker id="insieme" fill={colors.surface} radius={28} offset={4} padding={16} tiltMax={0.8} style={{ marginRight: 14 }}>
        <View style={{ gap: 12 }}>
          <Text variant="title" accessibilityRole="header">
            {S.us.together}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {rows.map((r) => (
              <Sticker key={r.id} id={`together-${r.id}`} fill={r.fill} radius={18} offset={3} padding={0} tiltMax={1.5} onPress={() => router.push(r.to)} haptic="light" accessibilityLabel={r.label} style={{ flexGrow: 1 }}>
                <Text variant="bodyStrong" align="center" style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  {r.label}
                </Text>
              </Sticker>
            ))}
          </View>
        </View>
      </Sticker>
    </>
  );
}

/** Noi: la coppia (nomi, data) come adesivo grande, poi le impostazioni come righe di un secondo adesivo. */
export function UsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const me = useCouple((s) => s.meName);
  const partner = useCouple((s) => s.partnerName);
  const start = useCouple((s) => s.startDate);
  const coupleId = useCouple((s) => s.coupleId);
  const haptics = useSettings((s) => s.haptics);
  const setHaptics = useSettings((s) => s.setHaptics);
  const sounds = useSettings((s) => s.sounds);
  const setSounds = useSettings((s) => s.setSounds);
  const reduce = useSettings((s) => s.reduceMotionOverride);
  const setReduce = useSettings((s) => s.setReduceMotionOverride);
  const setOnboardingDone = useSettings((s) => s.setOnboardingDone);
  const [edit, setEdit] = useState(false);
  const sessionLost = useCouple((s) => s.sessionLost);
  const serverDownRaw = useNet((s) => s.serverDown);
  const backendKind = useCouple((s) => s.backendKind);
  const serverDown = serverDownRaw && backendKind === "supabase";
  const dismissLost = useCouple((s) => s.dismissSessionLost);
  const days = daysSince(start);
  const versionLabel = appVersionLabel();

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
      </View>
      {serverDown ? (
        <Sticker id="server-dorme" fill={colors.butterSoft} radius={24} offset={4} padding={16} tiltMax={1}>
          <View style={{ gap: 6 }}>
            <Text variant="title" accessibilityRole="header">
              {S.link.serverDownTitle}
            </Text>
            <Text variant="body">{S.link.serverDownBody}</Text>
          </View>
        </Sticker>
      ) : null}
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

      {coupleId ? <DistanceCard /> : null}
      {coupleId ? <TogetherLinks /> : null}

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
              <Text variant="bodyStrong">{S.us.sounds}</Text>
              <Text variant="caption">{S.us.soundsHint}</Text>
            </View>
            <StickerSwitch value={sounds} onChange={setSounds} label={S.us.sounds} />
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
            {S.appName} · {versionLabel}
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
