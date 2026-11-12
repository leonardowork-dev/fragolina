import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  Icon,
  Mascot,
  MoodSticker,
  Skeleton,
  Sticker,
  Text,
  useEffectsBus,
  useMascot,
  useTheme,
  useToast,
} from "@/design";
import { Screen } from "@/design/layout/Screen";
import { motion, radius } from "@/design/tokens";
import { LinkBadge } from "@/features/pairing/LinkBadge";
import { EditCoupleSheet } from "@/features/us/EditCoupleSheet";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { daysSince, formatLongDate, timeAgo } from "@/lib/time";
import { selectPairing, selectPingsToday, selectQuestion, useCouple } from "@/state/coupleStore";

import { MoodSheet } from "./MoodSheet";
import { RevealCard } from "./RevealCard";
import { RollingNumber } from "./RollingNumber";

/** Home: UN elemento dominante (il bottone "Penso a te" o, se manca una persona, l'invito a collegarsi). */

function ThinkHero() {
  const { colors } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const today = useCouple((s) => selectPingsToday(s));
  const link = useCouple((s) => s.link);
  const lastIn = useCouple((s) => s.lastPingReceivedAt);
  const totalIn = useCouple((s) => s.pingsReceivedTotal);
  const sendThought = useCouple((s) => s.sendThought);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPress = useCallback(
    (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      if (!sendThought()) return;
      useEffectsBus.getState().fireHearts(pageX, pageY);
      useMascot.getState().react("love");
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 2200);
    },
    [sendThought],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const offline = link === "offline";
  return (
    <View style={{ marginTop: 44 }}>
      <Sticker
        id="penso-a-te"
        fill={colors.accent}
        radius={32}
        offset={6}
        padding={22}
        tiltMax={1.2}
        pressScale={0.95}
        haptic="success"
        onPress={onPress}
        accessibilityLabel={S.a11y.thinkButton}
        faceStyle={{ minHeight: 232, justifyContent: "flex-end" }}
      >
        <View style={{ gap: 10 }}>
          <Text variant="hero" adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.7}>
            {S.home.thinkTitle}
          </Text>
          <Text variant="bodyStrong" numberOfLines={3}>
            {flash
              ? offline
                ? S.home.thinkQueued(partner)
                : S.home.thinkSent(partner)
              : S.home.thinkHint(partner)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="heart" size={20} fill={colors.butter} />
            <Text variant="caption">{S.home.thinkToday(today)}</Text>
          </View>
          <Text variant="caption" numberOfLines={2} style={{ opacity: 0.85 }}>
            {lastIn
              ? `${S.home.lastFrom(partner, timeAgo(lastIn))} · ${S.home.receivedTotal(partner, totalIn)}`
              : S.home.noneFrom(partner)}
          </Text>
        </View>
      </Sticker>
      <View style={{ position: "absolute", right: 10, top: -46 }} pointerEvents="box-none">
        <Mascot size={122} reactive />
      </View>
    </View>
  );
}

function ConnectHero() {
  const { colors } = useTheme();
  const router = useRouter();
  const partner = useCouple((s) => s.partnerName);
  const pairing = useCouple(selectPairing);
  const waiting = pairing === "waiting";
  return (
    <View style={{ marginTop: 44 }}>
      <Sticker
        id="collegati"
        fill={colors.accent}
        radius={32}
        offset={6}
        padding={22}
        tiltMax={1.2}
        pressScale={0.96}
        haptic="light"
        onPress={() => router.push("/(tabs)/us")}
        accessibilityLabel={waiting ? S.home.showCode : S.home.connect(partner)}
        faceStyle={{ minHeight: 232, justifyContent: "flex-end" }}
      >
        <View style={{ gap: 10 }}>
          <Text variant="hero" adjustsFontSizeToFit numberOfLines={3} minimumFontScale={0.6}>
            {waiting ? S.home.waitingTitle(partner) : S.home.notPairedTitle}
          </Text>
          <Text variant="bodyStrong" numberOfLines={4}>
            {waiting ? S.home.waitingBody : S.home.notPairedBody(partner)}
          </Text>
          <View style={{ alignSelf: "flex-start" }}>
            <Sticker
              id="collegati-cta"
              fill={colors.butter}
              radius={radius.round}
              offset={3}
              padding={0}
              tiltMax={1}
            >
              <Text variant="bodyStrong" style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
                {waiting ? S.home.showCode : S.home.connect(partner)}
              </Text>
            </Sticker>
          </View>
        </View>
      </Sticker>
      <View style={{ position: "absolute", right: 10, top: -46 }} pointerEvents="box-none">
        <Mascot size={122} mood="sleepy" />
      </View>
    </View>
  );
}

function DaysCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const start = useCouple((s) => s.startDate);
  const days = daysSince(start);
  const size = String(days).length >= 5 ? 34 : String(days).length === 4 ? 44 : 56;
  return (
    <Sticker
      id="giorni"
      fill={colors.butter}
      radius={radius.xl}
      offset={5}
      padding={18}
      tiltMax={1.5}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={
        start
          ? `${S.home.daysTitle}: ${days}. ${S.home.daysEdit}`
          : `${S.home.daysNone} ${S.home.daysNoneHint}`
      }
      style={{ flex: 1.35 }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="caption">{S.home.daysTitle}</Text>
        {start ? (
          <>
            <RollingNumber value={days} variant="hero" size={size} />
            <Text variant="caption" numberOfLines={2}>
              {days === 0 ? S.home.daysZero : `dal ${formatLongDate(start)}`}
            </Text>
          </>
        ) : (
          <>
            <Text
              variant="display"
              style={{ fontSize: 34, lineHeight: 36 }}
              numberOfLines={2}
              maxFontSizeMultiplier={1.2}
            >
              {S.home.daysNone}
            </Text>
            <Text variant="caption" numberOfLines={2}>
              {S.home.daysNoneHint}
            </Text>
          </>
        )}
      </View>
    </Sticker>
  );
}

/** L'umore di lei: sola lettura, si aggiorna in tempo reale. */
function MoodCard() {
  const { colors, reduceMotion } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const mood = useCouple((s) => s.partnerMood?.moodId ?? null);
  const loading = useCouple((s) => s.link === "connecting" && s.lastSyncAt === null);
  const k = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!reduceMotion)
      k.set(withSequence(withTiming(0.82, { duration: 0 }), withSpring(1, motion.springBouncy)));
  }, [mood, reduceMotion, k]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: k.get() }] }));
  return (
    <Sticker
      id="umore"
      fill={colors.sky}
      radius={radius.xl}
      offset={5}
      padding={14}
      tiltMax={2}
      accessibilityRole="text"
      accessibilityLabel={
        mood
          ? S.a11y.moodButton(partner, S.moods[mood])
          : `${S.home.moodTitle(partner)}: ${S.home.moodNone}`
      }
      style={{ flex: 1, marginTop: 26 }}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        {loading ? (
          <Skeleton width={84} height={84} radius={42} />
        ) : mood ? (
          <Animated.View style={pop}>
            <MoodSticker mood={mood} size={84} />
          </Animated.View>
        ) : (
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              borderWidth: 2.5,
              borderColor: colors.outline,
              borderStyle: "dashed",
              backgroundColor: colors.skySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              variant="display"
              style={{ fontSize: 40, lineHeight: 44 }}
              maxFontSizeMultiplier={1}
            >
              ?
            </Text>
          </View>
        )}
        <View style={{ alignItems: "center", alignSelf: "stretch" }}>
          <Text variant="caption" numberOfLines={1} align="center">
            {S.home.moodTitle(partner)}
          </Text>
          <Text
            variant="bodyStrong"
            numberOfLines={3}
            align="center"
            style={{ fontSize: 16, lineHeight: 20 }}
          >
            {mood ? S.moods[mood] : S.home.moodNone}
          </Text>
          {!mood && !loading ? (
            <Text
              variant="caption"
              align="center"
              style={{ fontSize: 13, lineHeight: 16 }}
              maxFontSizeMultiplier={1.3}
            >
              {S.home.moodNoneHint(partner)}
            </Text>
          ) : null}
        </View>
      </View>
    </Sticker>
  );
}

/** Il tuo umore: una riga sola, un tocco per cambiarlo. */
function MyMoodStrip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const mood = useCouple((s) => s.myMood?.moodId ?? null);
  return (
    <Sticker
      id="mio-umore"
      fill={colors.surface}
      radius={radius.lg}
      offset={4}
      padding={12}
      tiltMax={1}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={`${S.home.myMood}: ${mood ? S.moods[mood] : S.home.myMoodNone}. ${S.home.myMoodChange}`}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {mood ? (
          <MoodSticker mood={mood} size={44} />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2.5,
              borderColor: colors.outline,
              borderStyle: "dashed",
              backgroundColor: colors.blushSoft,
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text variant="caption">{S.home.myMood}</Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {mood ? S.moods[mood] : S.home.myMoodNone}
          </Text>
        </View>
        <Text variant="bodyStrong" color={colors.accentInk}>
          {S.home.myMoodChange}
        </Text>
      </View>
    </Sticker>
  );
}

function QuestionCard() {
  const { colors } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const q = useCouple((s) => selectQuestion(s));
  const revealedDay = useCouple((s) => s.revealedDay);
  const markRevealed = useCouple((s) => s.markRevealed);
  const answer = useCouple((s) => s.answerQuestion);
  const label = { a: q.a, b: q.b } as const;
  const answered = q.myAnswer !== null;
  return (
    <Sticker
      id="domanda"
      fill={colors.surface}
      radius={radius.lg}
      offset={4}
      padding={18}
      tiltMax={1}
      style={{ marginRight: 14 }}
    >
      <View style={{ gap: 12 }}>
        <Text variant="caption">{S.home.questionTitle}</Text>
        <Text variant="title">{q.text}</Text>
        <View style={{ gap: 10 }}>
          {(["a", "b"] as const).map((k) => {
            const mine = q.myAnswer === k;
            return (
              <Sticker
                key={k}
                id={`risposta-${k}`}
                fill={mine ? colors.leaf : colors.blushSoft}
                radius={radius.md}
                offset={mine || !answered ? 3 : 0}
                padding={0}
                tiltMax={0.8}
                onPress={answered ? undefined : () => answer(k)}
                haptic="tick"
                accessibilityLabel={label[k]}
                accessibilityHint={answered ? undefined : S.home.answerHint}
                style={{ opacity: answered && !mine ? 0.5 : 1 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 52,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2.5,
                      borderColor: colors.outline,
                      backgroundColor: mine ? colors.surface : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {mine ? <Icon name="check" size={16} /> : null}
                  </View>
                  <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
                    {label[k]}
                  </Text>
                </View>
              </Sticker>
            );
          })}
        </View>
        {!answered ? (
          <Text variant="caption">{S.home.answerHint}</Text>
        ) : q.partnerAnswer ? (
          <Animated.View entering={FadeIn.duration(motion.duration.enter).easing(motion.easeOut)}>
            <RevealCard
              partnerName={partner}
              answerLabel={label[q.partnerAnswer]}
              verdict={q.partnerAnswer === q.myAnswer ? S.home.sameAnswer : S.home.diffAnswer}
              revealed={revealedDay === q.day}
              onReveal={markRevealed}
            />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(motion.duration.enter).easing(motion.easeOut)}>
            <Text variant="body">{S.home.waitingPartner(partner)}</Text>
          </Animated.View>
        )}
      </View>
    </Sticker>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const [moodSheet, setMoodSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const taps = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partner = useCouple((s) => s.partnerName);
  const myMood = useCouple((s) => s.myMood?.moodId ?? null);
  const setMood = useCouple((s) => s.setMyMood);
  const pairing = useCouple(selectPairing);

  // Cinque tocchi sul titolo aprono il laboratorio del design (nascosto).
  const onTitle = () => {
    taps.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => (taps.current = 0), 1600);
    if (taps.current >= 5) {
      taps.current = 0;
      haptics.success();
      router.push("/design-lab");
    }
  };

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
        <Pressable
          onPress={onTitle}
          accessibilityRole="header"
          accessibilityLabel={S.appName}
          hitSlop={10}
          style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
        >
          <Text variant="title">{S.home.title}</Text>
        </Pressable>
        <LinkBadge />
      </View>
      {pairing === "paired" ? <ThinkHero /> : <ConnectHero />}
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <DaysCard onPress={() => setDateSheet(true)} />
        <MoodCard />
      </View>
      <MyMoodStrip onPress={() => setMoodSheet(true)} />
      {pairing === "paired" ? <QuestionCard /> : null}
      <MoodSheet
        visible={moodSheet}
        onClose={() => setMoodSheet(false)}
        current={myMood}
        partnerName={partner}
        onPick={(m) => {
          setMood(m);
          toast.show(S.toast.moodSet(S.moods[m]));
          setTimeout(() => setMoodSheet(false), 260);
        }}
      />
      <EditCoupleSheet
        visible={dateSheet}
        onClose={() => setDateSheet(false)}
        onSaved={() => toast.show(S.toast.saved)}
      />
    </Screen>
  );
}
