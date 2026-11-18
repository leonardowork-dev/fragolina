import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Button, EmptyState, Skeleton, Sticker, Text, useTheme } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { ConfirmSheet } from "@/features/pairing/ConfirmSheet";
import { type HubEntry, hubOrder, scoreSummary } from "@/lib/games/hub";
import type { GameKind } from "@/lib/games/types";
import { S } from "@/lib/strings.it";
import { timeAgo } from "@/lib/time";
import { selectPairing, useCouple } from "@/state/coupleStore";
import { useIntents } from "@/state/intentStore";
import { usePractice } from "@/state/practiceStore";

import { DrawGame } from "./DrawGame";
import { QuizGame } from "./QuizGame";
import { GAME_FILL, GameArt } from "./StartCard";
import { TrisGame } from "./TrisGame";
import { usePracticeBot, useGamesSource } from "./useGamesSource";

/**
 * Gioca. Un elemento dominante: la partita in cui "tocca a te" (se non c'è, quella in cui aspetti, o il gioco da
 * proporre); sotto gli altri due come adesivi diversi tra loro; i punteggi della coppia in uno sticker. Sotto ogni gioco
 * c'è la sua schermata (Tris, Quiz, Disegna). La prova con la Fragolina usa le stesse schermate con un avversario finto.
 */
function statusLine(e: HubEntry, partner: string, now: number): string {
  if (!e.game) return S.play.games[e.kind].line;
  const ago = timeAgo(e.at ?? now, now);
  return e.turn === "mine" ? S.play.mineAgo(partner, ago) : e.turn === "theirs" ? S.play.theirsAgo(partner, ago) : S.play.games[e.kind].line;
}

function TurnTag({ turn, partner }: { turn: HubEntry["turn"]; partner: string }) {
  const { colors } = useTheme();
  if (turn === "none") return null;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: turn === "mine" ? colors.ink : colors.white,
        borderColor: colors.outline,
        borderWidth: turn === "mine" ? 0 : 2,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text variant="caption" color={turn === "mine" ? colors.surface : colors.ink} style={{ fontSize: 14, lineHeight: 17 }}>
        {turn === "mine" ? S.play.mine : S.play.theirs(partner)}
      </Text>
    </View>
  );
}

export function PlayScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const pairing = useCouple(selectPairing);
  const available = useCouple((s) => s.gamesAvailable);
  const request = useIntents((s) => s.gameRequest);
  const [mode, setMode] = useState<"couple" | "practice">("couple");
  const [active, setActive] = useState<GameKind | null>(null);
  const [askReset, setAskReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const source = useGamesSource(mode);
  usePracticeBot(mode === "practice");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // all'apertura della scheda rileggo le partite (silenzioso)
  useEffect(() => {
    if (pairing === "paired") void useCouple.getState().refreshGames().catch(() => {});
  }, [pairing]);

  // link fragolina://play/<gioco>: la richiesta si legge una volta (si adatta lo stato durante il render, poi si azzera)
  const [handled, setHandled] = useState(0);
  if (request && request.seq !== handled) {
    setHandled(request.seq);
    if (request.kind && (pairing === "paired" || mode === "practice")) setActive(request.kind);
  }
  useEffect(() => {
    if (request) useIntents.getState().clearGame();
  }, [request]);

  const { dominant, others } = useMemo(() => hubOrder(source.games, source.me), [source.games, source.me]);
  const summary = useMemo(() => scoreSummary(source.scores, source.me, source.other), [source.scores, source.me, source.other]);

  const inPractice = mode === "practice";
  const couplePaired = pairing === "paired";

  if (active) {
    const back = () => setActive(null);
    return active === "tris" ? (
      <TrisGame source={source} onBack={back} />
    ) : active === "quiz" ? (
      <QuizGame source={source} onBack={back} />
    ) : (
      <DrawGame source={source} onBack={back} />
    );
  }

  const practiceCard = (
    <Sticker
      id="practice"
      fill={colors.butterSoft}
      radius={26}
      offset={5}
      padding={18}
      tiltMax={1.2}
      onPress={() => setMode("practice")}
      accessibilityLabel={`${S.play.practice.title}. ${S.play.practice.line}`}
    >
      <View style={{ gap: 8 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text variant="caption" color={colors.surface} style={{ fontSize: 12, lineHeight: 15 }}>
            {S.play.practice.badge}
          </Text>
        </View>
        <Text variant="title">{S.play.practice.title}</Text>
        <Text variant="body">{S.play.practice.line}</Text>
      </View>
    </Sticker>
  );

  // ----- stati: non collegati / manca la migrazione / caricamento -----
  if (!inPractice && !couplePaired)
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {S.play.title}
        </Text>
        <EmptyState
          mood="sleepy"
          title={S.play.unpaired.title}
          body={S.play.unpaired.body}
          actionLabel={S.play.unpaired.cta}
          onAction={() => router.navigate("/(tabs)/us")}
        />
        {practiceCard}
      </Screen>
    );
  if (!inPractice && available === false)
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {S.play.title}
        </Text>
        <Sticker id="games-unavailable" fill={colors.butterSoft} radius={20} offset={4} padding={16}>
          <View style={{ gap: 6 }}>
            <Text variant="title">{S.play.unavailable.title}</Text>
            <Text variant="body">{S.play.unavailable.body}</Text>
          </View>
        </Sticker>
        {practiceCard}
      </Screen>
    );
  if (!inPractice && available === null)
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {S.play.title}
        </Text>
        <Text variant="caption" accessibilityLiveRegion="polite">
          {S.play.loading}
        </Text>
        <Skeleton height={190} radius={32} />
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1.2 }}>
            <Skeleton height={170} radius={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Skeleton height={150} radius={26} />
          </View>
        </View>
      </Screen>
    );

  const dom = dominant;
  const [a, b] = others;
  const open = (k: GameKind) => setActive(k);

  type Line = { key: string; label: string; text: string };
  const scoreLines: Line[] = [];
  if (summary.tris)
    scoreLines.push({ key: "tris", label: S.play.score.trisLabel, text: S.play.score.tris(source.meName, summary.tris.mine, source.partnerName, summary.tris.theirs) });
  if (summary.quiz) scoreLines.push({ key: "quiz", label: S.play.score.quizLabel, text: S.play.score.quiz(summary.quiz.right, summary.quiz.total) });
  if (summary.draw) scoreLines.push({ key: "draw", label: S.play.score.drawLabel, text: S.play.score.draw(summary.draw.solved) });

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="display" accessibilityRole="header">
          {S.play.title}
        </Text>
        <Text variant="caption">{inPractice ? S.play.practice.banner : S.play.sub}</Text>
      </View>
      {inPractice ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text variant="caption" color={colors.surface} style={{ fontSize: 12, lineHeight: 15 }}>
              {S.play.practice.badge}
            </Text>
          </View>
          <Button label={S.play.practice.exit} variant="ghost" onPress={() => setMode("couple")} haptic="tick" />
        </View>
      ) : null}
      {!inPractice && source.offline ? (
        <Text variant="caption" color={colors.accentInk} accessibilityRole="alert">
          {S.play.offline}
        </Text>
      ) : null}

      {/* l'elemento dominante */}
      <Sticker
        id={`dominant-${dom.kind}`}
        fill={GAME_FILL(colors, dom.kind)}
        radius={32}
        offset={6}
        padding={22}
        tiltMax={1.5}
        onPress={() => open(dom.kind)}
        faceStyle={{ minHeight: 210, justifyContent: "center" }}
        accessibilityLabel={`${S.play.games[dom.kind].name}. ${dom.turn === "mine" ? S.play.mine : dom.turn === "theirs" ? S.play.theirs(source.partnerName) : S.play.heroNone}`}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ flex: 1, gap: 8 }}>
            {dom.turn === "none" ? (
              <Text variant="caption">{S.play.heroNone}</Text>
            ) : (
              <TurnTag turn={dom.turn} partner={source.partnerName} />
            )}
            <Text variant="display" style={{ fontSize: 30, lineHeight: 30 }} maxFontSizeMultiplier={1.25}>
              {S.play.games[dom.kind].name}
            </Text>
            <Text variant="body">{dom.turn === "none" ? S.play.heroNoneSub : statusLine(dom, source.partnerName, now)}</Text>
            <Text variant="bodyStrong" color={colors.accentInk}>
              {dom.game ? S.play.resume : S.play.start}
            </Text>
          </View>
          <GameArt kind={dom.kind} size={dom.kind === "tris" ? 118 : 100} />
        </View>
      </Sticker>

      {/* gli altri due: adesivi diversi (larghezza, altezza, inclinazione) */}
      <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        {a ? (
          <Sticker
            id={`other-${a.kind}`}
            fill={GAME_FILL(colors, a.kind)}
            radius={26}
            offset={5}
            padding={16}
            tiltMax={2}
            onPress={() => open(a.kind)}
            style={{ flex: 1.2 }}
            faceStyle={{ minHeight: 240 }}
            accessibilityLabel={`${S.play.games[a.kind].name}. ${a.turn === "mine" ? S.play.mine : a.turn === "theirs" ? S.play.theirs(source.partnerName) : S.play.games[a.kind].line}`}
          >
            <View style={{ gap: 8, alignItems: "flex-start" }}>
              <GameArt kind={a.kind} size={92} />
              <TurnTag turn={a.turn} partner={source.partnerName} />
              <Text variant="title" style={{ fontSize: 22, lineHeight: 23 }}>
                {S.play.games[a.kind].name}
              </Text>
              <Text variant="caption">{a.turn === "none" ? S.play.games[a.kind].line : statusLine(a, source.partnerName, now)}</Text>
            </View>
          </Sticker>
        ) : null}
        {b ? (
          <Sticker
            id={`other-${b.kind}`}
            fill={GAME_FILL(colors, b.kind)}
            radius={26}
            offset={5}
            padding={14}
            tiltMax={2.5}
            onPress={() => open(b.kind)}
            style={{ flex: 1, marginTop: 40 }}
            faceStyle={{ minHeight: 210 }}
            accessibilityLabel={`${S.play.games[b.kind].name}. ${b.turn === "mine" ? S.play.mine : b.turn === "theirs" ? S.play.theirs(source.partnerName) : S.play.games[b.kind].line}`}
          >
            <View style={{ gap: 8, alignItems: "flex-start" }}>
              <GameArt kind={b.kind} size={80} />
              <TurnTag turn={b.turn} partner={source.partnerName} />
              <Text variant="title" style={{ fontSize: 20, lineHeight: 21 }}>
                {S.play.games[b.kind].name}
              </Text>
              <Text variant="caption" style={{ fontSize: 14, lineHeight: 18 }}>
                {b.turn === "none" ? S.play.games[b.kind].line : statusLine(b, source.partnerName, now)}
              </Text>
            </View>
          </Sticker>
        ) : null}
      </View>

      {/* i punteggi della coppia */}
      <Sticker id="scores" fill={colors.blushSoft} radius={20} offset={4} padding={14} tiltMax={1}>
        <View style={{ gap: 6 }}>
          <Text variant="caption">{S.play.score.title}</Text>
          {scoreLines.length === 0 ? (
            <Text variant="body">{S.play.score.none}</Text>
          ) : (
            scoreLines.map((l) => (
              <Text key={l.key} variant={l.key === "tris" ? "bodyStrong" : "body"} accessibilityLabel={`${l.label}: ${l.text}`}>
                {l.key === "tris" ? l.text : `${l.label}: ${l.text}`}
              </Text>
            ))
          )}
        </View>
      </Sticker>

      {/* la prova: ben visibile se non siete in due, un link piccolo altrimenti */}
      {inPractice ? (
        <Button label={S.play.practice.reset} variant="ghost" onPress={() => setAskReset(true)} haptic="light" />
      ) : couplePaired ? (
        <Button label={S.play.practice.small} variant="ghost" onPress={() => setMode("practice")} haptic="tick" />
      ) : null}
      <ConfirmSheet
        visible={askReset}
        title={S.play.practice.resetAsk}
        body={S.play.practice.resetBody}
        confirmLabel={S.play.practice.reset}
        cancelLabel={S.play.leaveNo}
        onClose={() => setAskReset(false)}
        onConfirm={() => {
          setAskReset(false);
          usePractice.getState().reset();
        }}
      />
    </Screen>
  );
}
