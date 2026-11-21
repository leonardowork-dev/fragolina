import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { Button, Chip, Sheet, Sticker, Text, TextField, useTheme } from "@/design";
import { motion } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { play } from "@/lib/sound";
import { S } from "@/lib/strings.it";
import { addDaysIso } from "@/lib/time";
import { uuid } from "@/lib/uuid";
import { useCouple } from "@/state/coupleStore";
import { selectZoneView, useZone } from "@/state/zoneStore";

import { useHeat } from "./HeatBurst";
import { DieFace, HeartArt } from "./ZoneArt";

function useView() {
  const role = useCouple((s) => s.myRole);
  const zone = useZone();
  return { zone, view: useMemo(() => selectZoneView(zone, role, zone.snapshot.now || 1), [zone, role]) };
}

/** "Ho voglia" (segnale discreto) e "Stasera?" (sì/forse/no in segreto). */
export function TonightTab() {
  const { colors } = useTheme();
  const { zone, view } = useView();
  const partner = useCouple((s) => s.partnerName);
  const t = view.tonight;
  const levels = [1, 2, 3] as const;
  return (
    <View style={{ gap: 16 }}>
      <Text variant="title" accessibilityRole="header">{S.zone.signalTitle}</Text>
      <Text variant="body">{S.zone.signalBody}</Text>
      {view.signal.incoming ? (
        <Sticker id="sig-in" fill={colors.accent} radius={24} offset={5} padding={16} tiltMax={1.2} style={{ marginRight: 6 }}>
          <Text variant="title" style={{ color: "#FFF" }}>{S.zone.signalIncoming(partner || "…", S.zone.signalLevels[view.signal.incoming.level])}</Text>
        </Sticker>
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {levels.map((l) => (
          <Sticker key={l} id={`sig-${l}`} fill={view.signal.mine?.level === l ? colors.accent : colors.blush} radius={22} offset={4} padding={12} tiltMax={1.5} haptic="success" onPress={() => { zone.enqueue({ kind: "signal", level: l }); play("pop"); }} accessibilityLabel={S.zone.signalLevels[l]} style={{ flex: 1 }}>
            <Text variant="bodyStrong" align="center">{S.zone.signalLevels[l]}</Text>
          </Sticker>
        ))}
      </View>
      {view.signal.mine ? <><Text variant="caption">{S.zone.signalSent}</Text><Button label={S.zone.signalClear} variant="ghost" onPress={() => zone.enqueue({ kind: "signalClear" })} /></> : null}

      <Text variant="title" accessibilityRole="header">{S.zone.tonightTitle}</Text>
      <Text variant="body">{S.zone.tonightBody}</Text>
      {t.result === "match" ? (
        <Sticker id="tn-match" fill={colors.accent} radius={26} offset={5} padding={18} tiltMax={1.2} style={{ marginRight: 6 }}>
          <Text variant="title" style={{ color: "#FFF" }}>{S.zone.tonightMatch}</Text>
          <Text variant="body" style={{ color: "#FFF" }}>{S.zone.tonightMatchSub}</Text>
        </Sticker>
      ) : t.result === "nomatch" ? (
        <Sticker id="tn-no" fill={colors.skySoft} radius={26} offset={4} padding={18} tiltMax={1} style={{ marginRight: 6 }}>
          <Text variant="title">{S.zone.tonightNoMatch}</Text>
          <Text variant="body">{S.zone.tonightNoMatchSub}</Text>
        </Sticker>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {(["yes", "maybe", "no"] as const).map((a) => (
              <Sticker key={a} id={`tn-${a}`} fill={t.mine === a ? colors.accent : colors.surface} radius={22} offset={4} padding={14} tiltMax={1.5} haptic="light" onPress={() => zone.enqueue({ kind: "tonight", answer: a })} accessibilityLabel={a === "yes" ? S.zone.tonightYes : a === "maybe" ? S.zone.tonightMaybe : S.zone.tonightNo} style={{ flex: 1 }}>
                <Text variant="bodyStrong" align="center">{a === "yes" ? S.zone.tonightYes : a === "maybe" ? S.zone.tonightMaybe : S.zone.tonightNo}</Text>
              </Sticker>
            ))}
          </View>
          {t.mine ? <Text variant="caption">{S.zone.tonightWaiting}</Text> : t.otherAnswered ? <Text variant="caption">{S.zone.tonightOtherDone}</Text> : null}
        </>
      )}
    </View>
  );
}

/** Buoni piccanti: si regalano, si riscattano con un'animazione. */
export function CouponsTab() {
  const { colors } = useTheme();
  const { zone, view } = useView();
  const paired = useCouple((s) => !!s.coupleId && s.members.length >= 2);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("");
  const today = view.today;
  const send = () => {
    const n = Number(days);
    zone.enqueue({ kind: "voucherAdd", id: uuid(), title: title.trim(), expires: Number.isFinite(n) && n > 0 && today ? addDaysIso(today, Math.min(365, Math.floor(n))) : null });
    setTitle("");
    setDays("");
    setAdding(false);
  };
  const redeem = (id: string) => {
    zone.enqueue({ kind: "voucherRedeem", id });
    haptics.success();
    play("festa");
    useHeat.getState().fire("match", S.zone.couponRedeemed);
  };
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header">{S.zone.couponsTitle}</Text>
      <Text variant="body">{S.zone.couponsBody}</Text>
      <Button label={S.zone.couponNew} onPress={() => setAdding(true)} disabled={!paired && !zone.practice} />
      {!paired && !zone.practice ? <Text variant="caption">{S.zone.couponNoPartner}</Text> : null}
      {view.vouchers.length === 0 ? <Text variant="body">{S.zone.couponNone}</Text> : null}
      {view.vouchers.map((v) => {
        const expired = !!v.expires && !!today && v.expires < today;
        return (
          <Sticker key={v.id} id={`cp-${v.id}`} fill={v.redeemedAt ? colors.surface : v.fromMe ? colors.butterSoft : colors.blush} radius={22} offset={4} padding={14} tiltMax={1.6} style={{ marginRight: 6, opacity: v.redeemedAt || expired ? 0.65 : 1 }}>
            <View style={{ gap: 6 }}>
              <Text variant="caption">{v.fromMe ? S.zone.couponFromYou : S.zone.couponToYou}{v.expires ? ` · ${v.expires}` : ""}</Text>
              <Text variant="title">{v.title}</Text>
              {v.redeemedAt ? <Text variant="caption">{S.zone.couponRedeemed}</Text> : expired ? <Text variant="caption">{S.zone.couponExpired}</Text> : !v.fromMe ? <Button label={S.zone.couponRedeem} onPress={() => redeem(v.id)} /> : null}
              {v.fromMe && !v.redeemedAt ? <Button label={S.zone.couponDelete} variant="ghost" onPress={() => zone.enqueue({ kind: "voucherDelete", id: v.id })} /> : null}
            </View>
          </Sticker>
        );
      })}
      <Sheet visible={adding} onClose={() => setAdding(false)} title={S.zone.couponNew}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <TextField label={S.zone.couponTitle} value={title} onChange={setTitle} maxLength={40} placeholder={S.zone.couponPlaceholder} autoCapitalize="sentences" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {S.zone.couponIdeas.map((i) => <Chip key={i} id={`ci-${i}`} label={i} onPress={() => setTitle(i)} />)}
          </View>
          <TextField label={S.zone.couponExpires} value={days} onChange={(v) => setDays(v.replace(/\D/g, ""))} maxLength={3} autoCapitalize="none" />
          <Button label={S.zone.couponSend} disabled={title.trim().length < 2} onPress={send} />
        </View>
      </Sheet>
    </View>
  );
}

/** Dado piccante: due dadi (azione × parte/posto) che rotolano con molla. Le facce si possono cambiare (solo in memoria). */
export function DiceTab() {
  const { colors, reduceMotion } = useTheme();
  const [hot, setHot] = useState(false);
  const [custom, setCustom] = useState<{ a: string; p: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [res, setRes] = useState<{ a: string; p: string; n1: number; n2: number } | null>(null);
  const [rolling, setRolling] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const rot1 = useSharedValue(0), rot2 = useSharedValue(0), y1 = useSharedValue(0), y2 = useSharedValue(0);
  const st1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.get() }, { rotate: `${rot1.get()}deg` }] }));
  const st2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.get() }, { rotate: `${rot2.get()}deg` }] }));
  const actions = custom ? custom.a.split("\n").map((x) => x.trim()).filter(Boolean) : [...S.zone.diceActions, ...(hot ? S.zone.diceActionsHot : [])];
  const places = custom ? custom.p.split("\n").map((x) => x.trim()).filter(Boolean) : [...S.zone.dicePlaces, ...(hot ? S.zone.dicePlacesHot : [])];

  const roll = () => {
    if (rolling || !actions.length || !places.length) return;
    setRolling(true);
    haptics.light();
    const n1 = 1 + Math.floor(Math.random() * 6), n2 = 1 + Math.floor(Math.random() * 6);
    if (!reduceMotion) {
      rot1.set(withTiming(rot1.get() + 720 + Math.random() * 90, { duration: 900, easing: motion.easeOut }));
      rot2.set(withTiming(rot2.get() - 720 - Math.random() * 90, { duration: 1000, easing: motion.easeOut }));
      y1.set(withSequence(withSpring(-60, { duration: 260, dampingRatio: 0.6 }), withSpring(0, { duration: 420, dampingRatio: 0.4 })));
      y2.set(withSequence(withSpring(-80, { duration: 300, dampingRatio: 0.6 }), withSpring(0, { duration: 460, dampingRatio: 0.4 })));
    }
    timer.current = setTimeout(() => {
      setRes({ a: actions[Math.floor(Math.random() * actions.length)]!, p: places[Math.floor(Math.random() * places.length)]!, n1, n2 });
      setRolling(false);
      haptics.success();
      play("tok");
    }, reduceMotion ? 120 : 1000);
  };
  return (
    <View style={{ gap: 14 }}>
      <Text variant="title" accessibilityRole="header">{S.zone.diceTitle}</Text>
      <Text variant="body">{S.zone.diceBody}</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text variant="caption">{S.zone.diceLevel}</Text>
        <Chip id="dl-0" label={S.zone.levels.dolce} selected={!hot} onPress={() => setHot(false)} />
        <Chip id="dl-1" label={S.zone.levels.piccante} selected={hot} onPress={() => setHot(true)} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, paddingVertical: 14 }}>
        <Animated.View style={st1}><DieFace n={res?.n1 ?? 3} size={84} /></Animated.View>
        <Animated.View style={st2}><DieFace n={res?.n2 ?? 5} size={84} /></Animated.View>
      </View>
      {res && !rolling ? (
        <Sticker id="dice-res" fill={colors.blush} radius={24} offset={4} padding={16} tiltMax={1.2} style={{ marginRight: 6 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <HeartArt size={26} />
            <Text variant="title" style={{ flex: 1 }}>{`${res.a} ${S.zone.diceFor} ${res.p}`}</Text>
          </View>
        </Sticker>
      ) : null}
      <Button label={S.zone.diceRoll} onPress={roll} disabled={rolling} />
      <Button label={S.zone.diceEdit} variant="secondary" onPress={() => setEditing(true)} />
      <Sheet visible={editing} onClose={() => setEditing(false)} title={S.zone.diceEdit}>
        <View style={{ gap: 12, marginTop: 8 }}>
          <TextField label={S.zone.diceFaceActions} value={custom?.a ?? actions.join("\n")} onChange={(v) => setCustom({ a: v, p: custom?.p ?? places.join("\n") })} maxLength={400} multiline minHeight={110} autoCapitalize="sentences" />
          <TextField label={S.zone.diceFacePlaces} value={custom?.p ?? places.join("\n")} onChange={(v) => setCustom({ a: custom?.a ?? actions.join("\n"), p: v })} maxLength={400} multiline minHeight={110} autoCapitalize="sentences" />
          <Button label={S.zone.diceReset} variant="ghost" onPress={() => setCustom(null)} />
        </View>
      </Sheet>
    </View>
  );
}
