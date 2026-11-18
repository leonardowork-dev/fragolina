import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Button, Sticker, StickerPressable, Text, useEffectsBus, useTheme } from "@/design";
import { motion, outline } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { QUIZ_DECK } from "@/lib/games/quizDeck";
import { QUIZ_LEN } from "@/lib/games/reducer";
import type { GameRow, QuizData } from "@/lib/games/types";
import { S } from "@/lib/strings.it";

import { GameShell } from "./GameShell";
import { StartCard } from "./StartCard";
import { lastClosedOf, openGameOf, type GamesSource } from "./useGamesSource";
import { useGameReward } from "./useReward";

/** Una carta che si gira alla rivelazione (rotazione con easeOut; con "meno movimento" solo dissolvenza). */
function FlipCard({
  revealed,
  ok,
  index,
}: {
  revealed: boolean;
  ok: boolean;
  index: number;
}) {
  const { colors, reduceMotion } = useTheme();
  const t = useSharedValue(revealed ? 1 : 0);
  useEffect(() => {
    // già rivelata quando si apre la schermata = ferma; si gira solo se la rivelazione avviene mentre guardi
    if (reduceMotion) return void t.set(revealed ? 1 : 0);
    t.set(withTiming(revealed ? 1 : 0, { duration: 420, easing: motion.easeOut }));
  }, [revealed, reduceMotion, t]);
  const back = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 - t.get() : t.get() < 0.5 ? 1 : 0,
    transform: reduceMotion ? [] : [{ perspective: 600 }, { rotateY: `${t.get() * 180}deg` }],
  }));
  const front = useAnimatedStyle(() => ({
    opacity: reduceMotion ? t.get() : t.get() >= 0.5 ? 1 : 0,
    transform: reduceMotion ? [] : [{ perspective: 600 }, { rotateY: `${(t.get() - 1) * 180}deg` }],
  }));
  const face = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: outline.width,
    borderColor: colors.outline,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const state = revealed ? (ok ? "indovinata" : "sbagliata") : "da rivelare";
  return (
    <View style={{ width: 52, height: 68 }} accessibilityLabel={S.play.quiz.cardLabel(index + 1, state)} accessibilityRole="image">
      <Animated.View style={[face, { backgroundColor: colors.butter }, back]}>
        <Text variant="title">{S.play.quiz.cardBack}</Text>
      </Animated.View>
      <Animated.View style={[face, { backgroundColor: ok ? colors.leaf : colors.blush }, front]}>
        <Text variant="title">{ok ? "✓" : "✗"}</Text>
      </Animated.View>
    </View>
  );
}

const nameOf = (source: GamesSource, uid: string) => (uid === source.me ? source.meName : source.partnerName);

export function QuizGame({ source, onBack }: { source: GamesSource; onBack: () => void }) {
  const { colors } = useTheme();
  const open = openGameOf(source.games, "quiz");
  const closed = lastClosedOf(source.games, "quiz");
  const game: GameRow | null = open ?? closed;
  const d = game?.data as QuizData | undefined;

  const prevReveals = useRef(d ? d.reveals.filter(Boolean).length : 0);
  useEffect(() => {
    if (!d) return;
    const n = d.reveals.filter(Boolean).length;
    if (n > prevReveals.current) haptics.success();
    prevReveals.current = n;
  }, [d]);
  const wasOpen = useRef(game?.status === "open");
  useEffect(() => {
    if (!game) return;
    if (wasOpen.current && game.status === "done" && (game.result as { score: number }).score >= 4) useEffectsBus.getState().fireConfetti();
    wasOpen.current = game.status === "open";
  }, [game]);
  useGameReward(game, source.mode === "couple");

  // la domanda "mia" di adesso: la prima in cui non ho ancora risposto nel mio ruolo
  const current = d ? d.subjects.findIndex((s, q) => !d.answered[q][s === source.me ? "s" : "g"]) : -1;
  const waiting = !!d && game?.status === "open" && current < 0;
  const score = d?.score ?? 0;
  const done = game?.status === "done";

  const renderQuestion = (q: number) => {
    if (!d) return null;
    const card = QUIZ_DECK[d.qids[q]];
    if (!card) return null;
    const iAmSubject = d.subjects[q] === source.me;
    const text = iAmSubject ? card.you : card.them.replace("{n}", nameOf(source, d.subjects[q]));
    return { card, iAmSubject, text };
  };

  const cur = current >= 0 ? renderQuestion(current) : null;

  return (
    <GameShell
      title={S.play.games.quiz.name}
      onBack={onBack}
      practice={source.mode === "practice"}
      offline={source.offline}
      onLeave={open ? () => source.abandon(open.id) : undefined}
    >
      {!game || !d ? (
        <StartCard kind="quiz" onStart={() => source.start("quiz")} />
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} accessibilityRole="list">
            {d.reveals.map((r, q) => (
              <FlipCard key={q} index={q} revealed={!!r} ok={!!r?.ok} />
            ))}
          </View>

          {cur && game.status === "open" ? (
            <Sticker id={`quiz-q-${game.id}-${current}`} fill={cur.iAmSubject ? colors.butter : colors.sky} radius={28} offset={6} padding={20} tiltMax={1}>
              <View style={{ gap: 14 }}>
                <Text variant="caption" accessibilityRole="header">
                  {`${S.play.quiz.progress(current + 1, QUIZ_LEN)} · ${cur.iAmSubject ? S.play.quiz.aboutYou : S.play.quiz.aboutThem(source.partnerName)}`}
                </Text>
                <Text variant="display" style={{ fontSize: 28, lineHeight: 30 }} maxFontSizeMultiplier={1.25}>
                  {cur.text}
                </Text>
                <Text variant="caption">{cur.iAmSubject ? S.play.quiz.answerYou : S.play.quiz.guess(source.partnerName)}</Text>
                <View style={{ gap: 10 }}>
                  {cur.card.options.map((opt, i) => (
                    <StickerPressable
                      key={opt}
                      haptic="light"
                      onPress={() => source.move(game.id, { type: "answer", q: current, idx: i })}
                      accessibilityRole="button"
                      accessibilityLabel={S.play.quiz.option(i + 1, opt)}
                      style={{
                        minHeight: 52,
                        justifyContent: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 18,
                        borderWidth: outline.width,
                        borderColor: colors.outline,
                        backgroundColor: colors.white,
                      }}
                    >
                      <Text variant="bodyStrong">{opt}</Text>
                    </StickerPressable>
                  ))}
                </View>
              </View>
            </Sticker>
          ) : null}

          {waiting ? (
            <Sticker id="quiz-wait" fill={colors.blushSoft} radius={22} offset={4} padding={16} tiltMax={1}>
              <View style={{ gap: 4 }}>
                <Text variant="title">{S.play.quiz.wait(source.partnerName)}</Text>
                <Text variant="caption">{S.play.quiz.sent}</Text>
                {source.mode === "practice" ? <Text variant="caption">{`${S.play.practice.name} ${S.play.practice.thinking}`}</Text> : null}
              </View>
            </Sticker>
          ) : null}

          {done ? (
            <Sticker id="quiz-result" fill={colors.leaf} radius={28} offset={6} padding={20} tiltMax={1.5}>
              <View style={{ gap: 4 }}>
                <Text variant="caption">{S.play.quiz.resultTitle}</Text>
                <Text variant="display" style={{ fontSize: 30, lineHeight: 32 }} accessibilityLiveRegion="polite">
                  {S.play.quiz.result(score, QUIZ_LEN)}
                </Text>
              </View>
            </Sticker>
          ) : null}
          {game.status === "abandoned" ? (
            <Text variant="title">
              {(game.result as { by?: string } | null)?.by === source.me ? S.play.leftByMe : S.play.leftByThem(source.partnerName)}
            </Text>
          ) : null}

          {/* le carte rivelate: chi ha detto cosa */}
          <View style={{ gap: 10 }}>
            {d.reveals.map((r, q) => {
              if (!r) return null;
              const info = renderQuestion(q);
              if (!info) return null;
              const subj = d.subjects[q];
              const subjName = nameOf(source, subj);
              const guesserName = nameOf(source, subj === source.me ? source.other : source.me);
              return (
                <Sticker key={q} id={`quiz-r-${game.id}-${q}`} fill={r.ok ? colors.leafSoft : colors.blushSoft} radius={20} offset={3} padding={14} tiltMax={1}>
                  <View style={{ gap: 4 }}>
                    <Text variant="caption">{info.text}</Text>
                    <Text variant="bodyStrong">{S.play.quiz.answeredBy(subjName, info.card.options[r.s] ?? "?")}</Text>
                    <Text variant="body">
                      {r.ok ? S.play.quiz.hit : S.play.quiz.guessedBy(guesserName, info.card.options[r.g] ?? "?")}
                    </Text>
                  </View>
                </Sticker>
              );
            })}
          </View>

          {game.pending ? <Text variant="caption">{S.play.pending}</Text> : null}

          {game.status !== "open" ? (
            <Button label={S.play.next} onPress={() => source.start("quiz")} haptic="medium" />
          ) : null}
        </>
      )}
    </GameShell>
  );
}
