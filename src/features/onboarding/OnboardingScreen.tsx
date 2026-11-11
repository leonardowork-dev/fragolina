import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { type SharedValue, interpolate, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, Button, Icon, Mascot, Sticker, Text, useEffectsBus, useMascot, useTheme } from "@/design";
import { fonts, outline, PAGE_MARGIN } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { S } from "@/lib/strings.it";
import { daysSince } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { WelcomeCluster, WidgetMock } from "./Previews";
import { useSettings } from "@/state/settingsStore";

/**
 * Onboarding: tre schermi che si sfogliano. La mascotte resta ferma in alto e reagisce a ogni pagina;
 * paginazione = fila di adesivi minuscoli; coriandoli una sola volta, all'ultimo schermo. Solo al primo avvio.
 */
const PAGES = 3;

function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const near = interpolate(progress.get(), [index - 1, index, index + 1], [0, 1, 0], "clamp");
    return { opacity: 0.45 + 0.55 * near, transform: [{ scale: 0.85 + 0.25 * near }] };
  });
  return (
    <Animated.View style={style}>
      <Sticker id={`dot-${index}`} fill={colors.accent} radius={6} offset={2} padding={0} tiltMax={8}>
        <View style={{ width: 16, height: 16 }} />
      </Sticker>
    </Animated.View>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<Animated.ScrollView>(null);
  const progress = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "error" | "ok">("idle");
  const confettiDone = useRef(false);
  const setDone = useSettings((s) => s.setOnboardingDone);
  const partner = useCouple((s) => s.partnerName);
  const me = useCouple((s) => s.meName);
  const startDate = useCouple((s) => s.startDate);

  const goTo = useCallback(
    (p: number) => {
      scroller.current?.scrollTo({ x: p * width, animated: !reduceMotion });
    },
    [width, reduceMotion],
  );

  // Scroll sul thread UI: aggiorna solo lo shared value. La pagina (state) cambia solo quando il valore arrotondato
  // attraversa una soglia, mai per frame.
  const onScroll = useAnimatedScrollHandler((e) => {
    progress.set(e.contentOffset.x / width);
  });
  const onPageChange = useCallback((p: number) => {
    setPage(p);
    haptics.tick();
  }, []);
  useAnimatedReaction(
    () => Math.round(progress.get()),
    (p, prev) => {
      if (prev !== null && p !== prev) scheduleOnRN(onPageChange, p);
    },
  );

  // Reazione della mascotte a ogni pagina + coriandoli una sola volta all'ultima.
  useEffect(() => {
    const mood = page === 0 ? "happy" : page === 1 ? "surprised" : "love";
    useMascot.getState().react(mood, 2200);
    if (page === 2 && !confettiDone.current) {
      confettiDone.current = true;
      haptics.success();
      useEffectsBus.getState().fireConfetti();
    }
  }, [page]);

  const finish = () => {
    setDone(true);
    router.replace("/");
  };

  const check = () => {
    const clean = code.trim();
    if (clean.length < 6) {
      setCodeState("error");
      haptics.light();
      return;
    }
    setCodeState("ok");
    haptics.success();
    useMascot.getState().react("love", 1800);
  };

  const primary = page === 0 ? S.common.next : page === 1 ? (codeState === "ok" ? S.common.next : S.onboarding.codeCheck) : S.onboarding.enter;
  const onPrimary = () => {
    if (page === 0) goTo(1);
    else if (page === 1) {
      if (codeState === "ok") goTo(2);
      else check();
    }
    else finish();
  };

  const pageStyle = { width, paddingHorizontal: PAGE_MARGIN, gap: 14 } as const;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.ground }}>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 12 }}>
      <View style={{ paddingHorizontal: PAGE_MARGIN, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", minHeight: 190 }}>
        <View style={{ marginTop: 12 }}>
          <Mascot size={150} reactive />
        </View>
        {page < PAGES - 1 ? <Button label={S.onboarding.skip} variant="ghost" onPress={finish} haptic="tick" /> : null}
      </View>

      <Animated.ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: "flex-start" }}
      >
        <View style={pageStyle}>
          <Text variant="hero" accessibilityRole="header" adjustsFontSizeToFit numberOfLines={2} minimumFontScale={0.7}>
            {S.onboarding.welcomeTitle(me)}
          </Text>
          <Text variant="body">{S.onboarding.welcomeBody}</Text>
          <View style={{ marginTop: 10 }}>
            <WelcomeCluster />
          </View>
        </View>

        <View style={pageStyle}>
          <Text variant="display" accessibilityRole="header">
            {S.onboarding.connectTitle(partner)}
          </Text>
          <Text variant="body">{S.onboarding.connectBody}</Text>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
              if (codeState !== "idle") setCodeState("idle");
            }}
            placeholder={S.onboarding.codePlaceholder}
            placeholderTextColor={colors.ink + "66"}
            accessibilityLabel={S.onboarding.codeLabel}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={check}
            style={{
              fontFamily: fonts.display,
              fontSize: 34,
              letterSpacing: 6,
              minHeight: 64,
              paddingHorizontal: 18,
              color: colors.ink,
              backgroundColor: colors.blushSoft,
              borderRadius: 20,
              borderWidth: outline.width,
              borderColor: codeState === "error" ? colors.accentInk : colors.outline,
            }}
          />
          {codeState === "error" ? (
            <Text variant="caption" color={colors.accentInk} accessibilityLiveRegion="polite">
              {S.onboarding.codeTooShort}
            </Text>
          ) : null}
          {codeState === "ok" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityLiveRegion="polite">
              <Avatar name={partner} size={44} fill={colors.sky} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {S.onboarding.codeOk(partner)}
              </Text>
              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.leaf, borderWidth: 2.5, borderColor: colors.outline, alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={20} />
              </View>
            </View>
          ) : null}
        </View>

        <View style={pageStyle}>
          <Text variant="hero" accessibilityRole="header" adjustsFontSizeToFit numberOfLines={3} minimumFontScale={0.7}>
            {S.onboarding.doneTitle}
          </Text>
          <Text variant="body">{S.onboarding.doneBody}</Text>
          <View style={{ marginTop: 14, gap: 10 }}>
            <Text variant="caption">{S.onboarding.widgetCaption}</Text>
            <WidgetMock partner={partner} mood="innamorata" days={daysSince(startDate)} />
          </View>
        </View>
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: PAGE_MARGIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", gap: 10 }} accessibilityLabel={`${page + 1} / ${PAGES}`} accessibilityRole="progressbar">
          {Array.from({ length: PAGES }, (_, i) => (
            <Dot key={i} index={i} progress={progress} />
          ))}
        </View>
        <Button label={primary} onPress={onPrimary} haptic={page === PAGES - 1 ? "success" : "light"} />
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}
