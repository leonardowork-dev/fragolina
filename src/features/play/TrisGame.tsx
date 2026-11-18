import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button, Sticker, StickerPressable, Text, useEffectsBus, useTheme } from "@/design";
import { motion, outline, PAGE_MARGIN } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { whoseTurn } from "@/lib/games/reducer";
import type { GameRow, TrisData } from "@/lib/games/types";
import { S } from "@/lib/strings.it";

import { FlowerPiece, StrawberryPiece } from "./art";
import { GameShell } from "./GameShell";
import { StartCard } from "./StartCard";
import { lastClosedOf, openGameOf, type GamesSource } from "./useGamesSource";
import { useGameReward } from "./useReward";

/** Una pedina che "si attacca": parte un po' più grande e scende nel posto con una molla (solo se è nuova). */
function Piece({ kind, size, fresh }: { kind: "X" | "O"; size: number; fresh: boolean }) {
  const { reduceMotion } = useTheme();
  const s = useSharedValue(fresh && !reduceMotion ? 1.45 : 1);
  const o = useSharedValue(fresh && !reduceMotion ? 0.3 : 1);
  useEffect(() => {
    if (!fresh || reduceMotion) return;
    s.set(withSpring(1, motion.springSnappy));
    o.set(withTiming(1, { duration: 120 }));
  }, [fresh, reduceMotion, s, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  return (
    <Animated.View style={style}>{kind === "X" ? <StrawberryPiece size={size} /> : <FlowerPiece size={size} />}</Animated.View>
  );
}

/** La linea vincente: una barra posata sopra le tre caselle (solo opacità e scala). */
function WinLine({ cell, gap, line, pad }: { cell: number; gap: number; line: number[]; pad: number }) {
  const { colors, reduceMotion } = useTheme();
  const k = useSharedValue(reduceMotion ? 1 : 0.55);
  const o = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    k.set(withDelay(150, withTiming(1, { duration: 280, easing: motion.easeOut })));
    o.set(withDelay(150, withTiming(1, { duration: 160 })));
  }, [reduceMotion, k, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scaleX: k.get() }] }));
  const center = (i: number) => ({
    x: pad + (i % 3) * (cell + gap) + cell / 2,
    y: pad + Math.floor(i / 3) * (cell + gap) + cell / 2,
  });
  const a = center(line[0]);
  const b = center(line[2]);
  const len = Math.hypot(b.x - a.x, b.y - a.y) + cell * 0.7;
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const H = 14;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: (a.x + b.x) / 2 - len / 2,
          top: (a.y + b.y) / 2 - H / 2,
          width: len,
          height: H,
          borderRadius: H / 2,
          backgroundColor: colors.butter,
          borderWidth: outline.width,
          borderColor: colors.outline,
          transform: [{ rotate: `${ang}deg` }],
        },
        style,
      ]}
    />
  );
}

export function TrisGame({ source, onBack }: { source: GamesSource; onBack: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const open = openGameOf(source.games, "tris");
  const closed = lastClosedOf(source.games, "tris");
  const game: GameRow | null = open ?? closed;
  const d = game?.data as TrisData | undefined;
  const turn = game ? whoseTurn(game, source.me) : "none";
  const myMark: "X" | "O" | null = d ? (d.x === source.me ? "X" : "O") : null;

  // pedine nuove = comparse dopo l'apertura della schermata (quelle già sul tavolo restano ferme)
  const [initial] = useState(() => ({ id: game?.id ?? null, board: d?.board ?? "---------" }));
  const base = initial.id === game?.id ? initial.board : "---------";
  const wasOpen = useRef(game?.status === "open");
  useEffect(() => {
    if (!game) return;
    if (wasOpen.current && game.status === "done" && (game.result as { winner: string | null }).winner === source.me)
      useEffectsBus.getState().fireConfetti();
    wasOpen.current = game.status === "open";
  }, [game, source.me]);
  useGameReward(game, source.mode === "couple");

  const boardW = Math.min(width - PAGE_MARGIN * 2, 420);
  const pad = 14;
  const gap = 8;
  const cell = Math.floor((boardW - pad * 2 - gap * 2 - outline.width * 2) / 3);
  const inner = cell * 3 + gap * 2 + pad * 2;

  const canMove = !!game && game.status === "open" && turn === "mine";
  const place = (i: number) => {
    if (!game || !d || !canMove || d.board[i] !== "-") return;
    haptics.light();
    source.move(game.id, { type: "place", cell: i });
  };

  const winner = game?.status === "done" ? ((game.result as { winner: string | null }).winner ?? null) : undefined;
  const status = useMemo(() => {
    if (!game) return "";
    if (game.status === "abandoned")
      return (game.result as { by?: string } | null)?.by === source.me ? S.play.leftByMe : S.play.leftByThem(source.partnerName);
    if (game.status === "done")
      return winner === source.me ? S.play.tris.won : winner ? S.play.tris.lost(source.partnerName) : S.play.tris.draw;
    return turn === "mine" ? S.play.tris.yourTurn : S.play.tris.theirTurn(source.partnerName);
  }, [game, winner, source.me, source.partnerName, turn]);

  const score = source.scores.tris;
  const mineWins = score?.[source.me]?.wins ?? 0;
  const theirWins = score?.[source.other]?.wins ?? 0;
  const thinking = source.mode === "practice" && game?.status === "open" && turn === "theirs" && source.botThinking("tris");

  return (
    <GameShell
      title={S.play.games.tris.name}
      onBack={onBack}
      practice={source.mode === "practice"}
      offline={source.offline}
      onLeave={open ? () => source.abandon(open.id) : undefined}
    >
      {!game ? (
        <StartCard kind="tris" onStart={() => source.start("tris")} />
      ) : (
        <>
          <Sticker id="tris-board" fill={colors.butterSoft} radius={28} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: boardW }}>
            <View
              style={{ width: inner, height: inner, padding: pad }}
              accessibilityRole="grid"
              accessibilityLabel={S.play.tris.board}
            >
              <View style={{ gap }}>
                {[0, 1, 2].map((r) => (
                  <View key={r} style={{ flexDirection: "row", gap }}>
                    {[0, 1, 2].map((c) => {
                      const i = r * 3 + c;
                      const m = d!.board[i];
                      const winning = !!d!.win?.includes(i);
                      const empty = m === "-";
                      const what = empty ? "empty" : m === "X" ? "strawberry" : "flower";
                      return (
                        <StickerPressable
                          key={c}
                          disabled={!canMove || !empty}
                          haptic="none"
                          onPress={() => place(i)}
                          accessibilityRole="button"
                          accessibilityLabel={S.play.tris.cell(r + 1, c + 1, what)}
                          accessibilityState={{ disabled: !canMove || !empty }}
                          style={{
                            width: cell,
                            height: cell,
                            borderRadius: 18,
                            borderWidth: outline.width,
                            borderColor: colors.outline,
                            backgroundColor: winning ? colors.leafSoft : colors.white,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {!empty ? <Piece kind={m as "X" | "O"} size={cell * 0.7} fresh={base[i] === "-"} /> : null}
                        </StickerPressable>
                      );
                    })}
                  </View>
                ))}
              </View>
              {d!.win ? <WinLine cell={cell} gap={gap} line={d!.win} pad={pad} /> : null}
            </View>
          </Sticker>

          <View style={{ gap: 6 }}>
            <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">
              {status}
            </Text>
            {game.status === "open" && myMark ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {myMark === "X" ? <StrawberryPiece size={26} /> : <FlowerPiece size={26} />}
                <Text variant="caption">
                  {S.play.tris.youAre(myMark === "X" ? S.play.tris.markStrawberry : S.play.tris.markFlower)}
                </Text>
              </View>
            ) : null}
            {thinking ? <Text variant="caption">{`${S.play.practice.name} ${S.play.practice.thinking}`}</Text> : null}
            {game.pending && source.offline ? <Text variant="caption">{S.play.pending}</Text> : null}
          </View>

          {game.status !== "open" ? (
            <Button label={S.play.rematch} onPress={() => source.start("tris")} haptic="medium" />
          ) : null}

          <Sticker id="tris-score" fill={colors.blushSoft} radius={18} offset={3} padding={12} tiltMax={1}>
            <Text variant="bodyStrong" accessibilityLabel={`${S.play.score.title}: ${S.play.score.tris(source.meName, mineWins, source.partnerName, theirWins)}`}>
              {S.play.score.tris(source.meName, mineWins, source.partnerName, theirWins)}
            </Text>
          </Sticker>
        </>
      )}
    </GameShell>
  );
}
