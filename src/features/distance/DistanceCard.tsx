import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { Button, Sheet, Sticker, StickerSwitch, Text, useTheme, useToast } from "@/design";
import { distanceView, haversineKm } from "@/lib/geo/distance";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";
import { useSettings } from "@/state/settingsStore";

import { type LocPerm, askAlways, askWhenInUse, currentRounded, getPerm, startBackground, stopBackground } from "./locationApi";

/**
 * "Distanza" nella scheda Noi: l'interruttore "Condividi la distanza" (spento = l'altro vede "distanza nascosta"),
 * la distanza di adesso e, su iOS, "Aggiorna anche ad app chiusa" (permesso "Sempre"). Il permesso lo spieghiamo noi
 * PRIMA che compaia quello di sistema. Si manda solo una posizione arrotondata (~1 km), mai il percorso.
 */
export function DistanceCard() {
  const { colors } = useTheme();
  const toast = useToast();
  const loc = useCouple((s) => s.loc);
  const partner = useCouple((s) => s.partnerName);
  const setSharing = useCouple((s) => s.setLocationSharing);
  const shareLocation = useCouple((s) => s.shareLocation);
  const available = useCouple((s) => s.noteAvailable);
  const always = useSettings((s) => s.locationAlways);
  const setAlways = useSettings((s) => s.setLocationAlways);
  const [perm, setPerm] = useState<LocPerm>("undetermined");
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPerm().then((p) => alive && setPerm(p));
    return () => {
      alive = false;
    };
  }, [loc.sharing]);

  const turnOn = useCallback(async () => {
    setBusy(true);
    try {
      const p = await askWhenInUse();
      setPerm(p);
      if (p !== "when" && p !== "always") return;
      const r = await setSharing(true);
      if (!r.ok) return void toast.show(S.pairing.errors[r.error] ?? S.pairing.errors.unknown);
      const pos = await currentRounded();
      if (pos) await shareLocation(pos);
    } finally {
      setBusy(false);
    }
  }, [setSharing, shareLocation, toast]);

  const onToggle = (v: boolean) => {
    if (busy) return;
    if (!v) {
      void setSharing(false);
      setAlways(false);
      void stopBackground();
      return;
    }
    void (async () => {
      const p = await getPerm(); // lo stato di adesso (può essere cambiato da Impostazioni)
      setPerm(p);
      if (p === "denied") return void toast.show(S.distance.denied);
      if (p === "undetermined") return setAsk(true); // prima spieghiamo noi, poi chiede il sistema
      void turnOn();
    })();
  };

  const onAlways = async (v: boolean) => {
    if (!v) {
      setAlways(false);
      await stopBackground();
      return;
    }
    const p = await askAlways();
    setPerm(p);
    if (p === "always") {
      setAlways(true);
      await startBackground();
    } else toast.show(S.distance.alwaysDenied);
  };

  const view =
    loc.partner?.state === "ok" && loc.me && loc.partner.latE2 !== null && loc.partner.lonE2 !== null
      ? distanceView(haversineKm(loc.me, { latE2: loc.partner.latE2, lonE2: loc.partner.lonE2 }))
      : null;

  const status = view
    ? view.near
      ? S.distance.near
      : S.distance.km(view.big)
    : loc.partner?.state === "hidden"
      ? S.distance.hidden
      : loc.partner?.state === "none" && loc.sharing
        ? S.distance.none
        : loc.sharing
          ? loc.me
            ? S.distance.on
            : S.distance.waiting
          : S.distance.off;

  return (
    <Sticker id="distanza" fill={colors.surface} radius={28} offset={4} padding={18} tiltMax={0.8} style={{ marginRight: 14 }}>
      <View style={{ gap: 14 }}>
        <Text variant="title" accessibilityRole="header">
          {S.distance.title}
        </Text>
        {view ? (
          <Text variant="display" accessibilityLabel={status}>
            {status}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{S.distance.toggle}</Text>
            <Text variant="caption">{view ? S.distance.toggleHint : status}</Text>
          </View>
          <StickerSwitch value={loc.sharing} onChange={onToggle} label={S.distance.toggle} />
        </View>
        {available === false ? <Text variant="caption">{S.draw.unavailable}</Text> : null}
        {perm === "denied" && !loc.sharing ? <Text variant="caption">{S.distance.denied}</Text> : null}
        {loc.sharing && Platform.OS === "ios" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{S.distance.always}</Text>
              <Text variant="caption">{S.distance.alwaysHint}</Text>
            </View>
            <StickerSwitch value={always && perm === "always"} onChange={(v) => void onAlways(v)} label={S.distance.always} />
          </View>
        ) : null}
        {loc.sharing && loc.partner && loc.partner.state === "none" ? (
          <Text variant="caption">{S.distance.noneSub(partner)}</Text>
        ) : null}
      </View>
      <Sheet visible={ask} onClose={() => setAsk(false)} title={S.distance.askTitle}>
        <View style={{ gap: 14, paddingBottom: 12 }}>
          <Text variant="body">{S.distance.askBody}</Text>
          <Button
            label={S.distance.askYes}
            haptic="success"
            onPress={() => {
              setAsk(false);
              void turnOn();
            }}
            fullWidth
          />
          <Button label={S.distance.askNo} variant="ghost" onPress={() => setAsk(false)} />
        </View>
      </Sheet>
    </Sticker>
  );
}
