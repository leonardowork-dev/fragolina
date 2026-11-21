import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { Button, Chip, Sheet, Sticker, Text, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { getBackend } from "@/lib/backend";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";
import { useZone } from "@/state/zoneStore";

import { PageHeader } from "../common/PageHeader";
import { CalendarTab } from "./CalendarTab";
import { CouponsTab, DiceTab, TonightTab } from "./MoreTabs";
import { WishesTab } from "./WishesTab";
import { ZoneLock } from "./ZoneLock";

type Tab = "calendar" | "wishes" | "tonight" | "coupons" | "dice";
const TABS: Tab[] = ["calendar", "wishes", "tonight", "coupons", "dice"];

/** Tiene la zona allineata: rilegge all'apertura, al segnale del contatore (realtime) e ogni 45 s a schermo aperto. */
export function useZoneSync(active: boolean) {
  const coupleId = useCouple((s) => s.coupleId);
  const practice = useZone((s) => s.practice);
  useEffect(() => {
    if (!active) return;
    const z = useZone.getState();
    void z.flush();
    void z.refresh();
    const poll = setInterval(() => {
      useZone.getState().touch();
      void useZone.getState().flush();
      void useZone.getState().refresh();
    }, 45_000);
    let off: (() => void) | null = null;
    if (coupleId && !practice) {
      try {
        off = getBackend().subscribeZone(coupleId, () => void useZone.getState().refresh());
      } catch {
        /* resta il sondaggio */
      }
    }
    return () => {
      clearInterval(poll);
      off?.();
    };
  }, [active, coupleId, practice]);
}

export function ZoneScreen() {
  const { colors } = useTheme();
  const unlocked = useZone((s) => s.unlocked);
  const available = useZone((s) => s.available);
  const practice = useZone((s) => s.practice);
  const queued = useZone((s) => s.queue.length);
  const paired = useCouple((s) => !!s.coupleId && s.members.length >= 2);
  const [tab, setTab] = useState<Tab>("calendar");

  // non siete ancora in due → prova da solo con una persona finta (solo su questo telefono)
  useEffect(() => {
    useZone.getState().setPractice(!paired);
  }, [paired]);
  useZoneSync(unlocked);

  return (
    <Screen>
      <PageHeader title={S.zone.title} />
      {!unlocked ? (
        <ZoneLock onOpen={() => useZone.getState().unlock()} />
      ) : (
        <View style={{ gap: 16 }}>
          {practice ? (
            <Sticker id="zone-practice" fill={colors.butter} radius={20} offset={3} padding={12} tiltMax={1} style={{ marginRight: 6 }}>
              <Text variant="bodyStrong">{S.zone.practiceTitle}</Text>
              <Text variant="caption">{S.zone.practiceBody}</Text>
            </Sticker>
          ) : null}
          {available === false ? (
            <Sticker id="zone-missing" fill={colors.butterSoft} radius={20} offset={3} padding={12} tiltMax={1} style={{ marginRight: 6 }}>
              <Text variant="caption">{S.zone.missing}</Text>
            </Sticker>
          ) : null}
          {queued > 0 ? <Text variant="caption">{S.zone.offline}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TABS.map((t) => <Chip key={t} id={`zt-${t}`} label={S.zone.tabs[t]} selected={tab === t} onPress={() => setTab(t)} />)}
          </View>
          {tab === "calendar" ? <CalendarTab /> : tab === "wishes" ? <WishesTab /> : tab === "tonight" ? <TonightTab /> : tab === "coupons" ? <CouponsTab /> : <DiceTab />}
          <WipeBlock />
        </View>
      )}
    </Screen>
  );
}

/** "Cancella tutto" con doppia conferma: toglie i dati della zona dal server, per entrambi. */
function WipeBlock() {
  const toast = useToast();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const wipe = async () => {
    setStep(0);
    if (await useZone.getState().wipeAll()) toast.show(S.zone.wiped);
  };
  return (
    <View style={{ gap: 8, marginTop: 24 }}>
      <Text variant="caption">{S.zone.settingsWipeHint}</Text>
      <Button label={S.zone.settingsWipe} variant="danger" onPress={() => setStep(1)} />
      <Sheet visible={step === 1} onClose={() => setStep(0)} title={S.zone.wipeTitle}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text variant="body">{S.zone.wipeBody}</Text>
          <Button label={S.zone.wipeConfirm} variant="danger" onPress={() => setStep(2)} />
          <Button label={S.pairing.keep} variant="ghost" onPress={() => setStep(0)} />
        </View>
      </Sheet>
      <Sheet visible={step === 2} onClose={() => setStep(0)} title={S.zone.wipeTitle2}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <Text variant="body">{S.zone.wipeBody2}</Text>
          <Button label={S.zone.wipeConfirm2} variant="danger" onPress={() => void wipe()} />
          <Button label={S.pairing.keep} variant="ghost" onPress={() => setStep(0)} />
        </View>
      </Sheet>
    </View>
  );
}
