import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  Icon,
  Mascot,
  MoodSticker,
  Sticker,
  Text,
  useEffectsBus,
  useMascot,
  useTheme,
} from "@/design";
import { Screen } from "@/design/layout/Screen";
import { motion, radius } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { daysSince, formatLongDate } from "@/lib/time";
import { selectThoughtsToday, useCouple } from "@/state/coupleStore";

import { MoodSheet } from "./MoodSheet";
import { RollingNumber } from "./RollingNumber";

/** Home: UN elemento dominante (il bottone "Penso a te"), il resto disposto in modo asimmetrico attorno. */

function ThinkHero() {
  const { colors } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const today = useCouple(selectThoughtsToday);
  const sendThought = useCouple((s) => s.sendThought);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPress = useCallback(
    (e: GestureResponderEvent) => {
      const { pageX, pageY } = e.nativeEvent;
      useEffectsBus.getState().fireHearts(pageX, pageY);
      useMascot.getState().react("love");
      sendThought();
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 1800);
    },
    [sendThought],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
            {flash ? S.home.thinkSent(partner) : S.home.thinkHint(partner)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="heart" size={20} fill={colors.butter} />
            <Text variant="caption">{S.home.thinkToday(today)}</Text>
          </View>
        </View>
      </Sticker>
      <View style={{ position: "absolute", right: 10, top: -46 }} pointerEvents="box-none">
        <Mascot size={122} reactive />
      </View>
    </View>
  );
}

function DaysCard() {
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
      accessibilityLabel={`${S.home.daysTitle}: ${days}`}
      accessibilityRole="text"
      style={{ flex: 1.35 }}
    >
      <View style={{ gap: 2 }}>
        <Text variant="caption">{S.home.daysTitle}</Text>
        <RollingNumber value={days} variant="hero" size={size} />
        <Text variant="caption" numberOfLines={2}>
          {days === 0 ? S.home.daysZero : `dal ${formatLongDate(start)}`}
        </Text>
      </View>
    </Sticker>
  );
}

function MoodCard({ onPress }: { onPress: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const mood = useCouple((s) => s.partnerMood);
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
      onPress={onPress}
      haptic="light"
      accessibilityLabel={S.a11y.moodButton(partner, S.moods[mood])}
      style={{ flex: 1, marginTop: 26 }}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <Animated.View style={pop}>
          <MoodSticker mood={mood} size={84} />
        </Animated.View>
        <View style={{ alignItems: "center", alignSelf: "stretch" }}>
          <Text variant="caption" numberOfLines={1} align="center">
            {S.home.moodTitle(partner)}
          </Text>
          <Text
            variant="bodyStrong"
            numberOfLines={2}
            align="center"
            style={{ fontSize: 16, lineHeight: 20 }}
          >
            {S.moods[mood]}
          </Text>
        </View>
      </View>
    </Sticker>
  );
}

function QuestionCard() {
  const { colors } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const q = useCouple((s) => s.question);
  const answer = useCouple((s) => s.answerQuestion);
  const label = { a: S.home.answerA, b: S.home.answerB } as const;
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
        <Text variant="title">{S.home.question}</Text>
        <View style={{ gap: 10 }}>
          {(["a", "b"] as const).map((k) => {
            const mine = q.myAnswer === k;
            return (
              <Sticker
                key={k}
                id={`risposta-${k}`}
                fill={mine ? colors.leaf : colors.blushSoft}
                radius={radius.md}
                offset={3}
                padding={0}
                tiltMax={0.8}
                onPress={() => answer(k)}
                haptic="tick"
                accessibilityLabel={label[k]}
                accessibilityHint={answered ? undefined : S.home.questionTitle}
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
        {answered ? (
          <Animated.View entering={FadeIn.duration(motion.duration.enter).easing(motion.easeOut)}>
            <Text variant="body">
              {q.partnerAnswer
                ? `${S.home.partnerAnswered(partner, label[q.partnerAnswer])}. ${q.partnerAnswer === q.myAnswer ? S.home.sameAnswer : S.home.diffAnswer}`
                : S.home.waitingPartner(partner)}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Sticker>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const taps = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partner = useCouple((s) => s.partnerName);
  const mood = useCouple((s) => s.partnerMood);
  const setMood = useCouple((s) => s.setPartnerMood);

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
      <Pressable
        onPress={onTitle}
        accessibilityRole="header"
        accessibilityLabel={S.appName}
        hitSlop={10}
        style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
      >
        <Text variant="title">{S.home.title}</Text>
      </Pressable>
      <ThinkHero />
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <DaysCard />
        <MoodCard onPress={() => setSheet(true)} />
      </View>
      <QuestionCard />
      <MoodSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        current={mood}
        partnerName={partner}
        onPick={(m) => {
          setMood(m);
          setTimeout(() => setSheet(false), 260);
        }}
      />
    </Screen>
  );
}
