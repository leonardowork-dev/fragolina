import React, { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";

import { Button, Mascot, Sticker, Text, useTheme } from "@/design";
import { fonts, outline, PAGE_MARGIN } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { play } from "@/lib/sound";
import { DRAW_MAX_GUESSES, GUESS_MAX, whoseTurn } from "@/lib/games/reducer";
import type { DrawData, GameRow } from "@/lib/games/types";
import type { NoteDraw } from "@/lib/note/rules";
import { S } from "@/lib/strings.it";
import { DRAFT_MAX_AGE_MS, useDrawDraft } from "@/state/drawDraftStore";

import { NoteDrawingSvg } from "../draw/NoteArt";
import { KeepButton } from "../memories/KeepButton";
import { DrawingReplay } from "./DrawingReplay";
import { GameShell } from "./GameShell";
import { SketchPad } from "./SketchPad";
import { StartCard } from "./StartCard";
import { lastClosedOf, openGameOf, type GamesSource } from "./useGamesSource";
import { useGameEndSound, useGameReward } from "./useReward";

const SECONDS = 60;
const nameOf = (source: GamesSource, uid: string) => (uid === source.me ? source.meName : source.partnerName);

/** Il giro di chi disegna: parola → via → 60 secondi → manda. */
function DrawerTurn({ source, game, word }: { source: GamesSource; game: GameRow; word: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [draft, setDraft] = useState<NoteDraw | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [sentFlag, setSentFlag] = useState(false);
  const sent = useRef(false);
  const draftRef = useRef<NoteDraw | null>(null);
  const size = Math.min(width - PAGE_MARGIN * 2 - 6, 480);

  const gameId = game.id;
  const onChange = useCallback(
    (d: NoteDraw | null) => {
      draftRef.current = d;
      setDraft(d);
      useDrawDraft.getState().save(gameId, d); // la bozza sopravvive a un'uscita dalla schermata o dall'app (KNOWN_ISSUES 38)
    },
    [gameId],
  );
  const send = (d: NoteDraw | null) => {
    if (!d || sent.current) return false;
    sent.current = true;
    setSentFlag(true);
    useDrawDraft.getState().clear(gameId);
    haptics.light();
    play("tok");
    source.move(game.id, { type: "drawing", content: d });
    return true;
  };
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  // Ripresa: se avevo cominciato a disegnare questa partita e sono uscito, riparto dai secondi che restano con il disegno
  // com'era; se il tempo è finito nel frattempo, parte ciò che c'era (o, se era vuoto, si ricomincia da "Via!").
  const draftReady = useDrawDraft((d) => d.hydrated);
  const [resumed, setResumed] = useState(false);
  const [initialDraft, setInitialDraft] = useState<NoteDraw | null>(null);
  useEffect(() => {
    if (!draftReady || resumed) return;
    /* eslint-disable react-hooks/set-state-in-effect -- si legge la bozza persistita una volta sola, appena è pronta */
    setResumed(true);
    const cur = useDrawDraft.getState().current;
    if (!cur || cur.gameId !== gameId) return;
    const left0 = Math.max(0, SECONDS - Math.floor((Date.now() - cur.startedAt) / 1000));
    if (Date.now() - cur.startedAt > DRAFT_MAX_AGE_MS) {
      useDrawDraft.getState().clear(gameId);
      return;
    }
    if (left0 <= 0) {
      if (!cur.draft || !sendRef.current(cur.draft)) useDrawDraft.getState().clear(gameId);
      return;
    }
    draftRef.current = cur.draft;
    setInitialDraft(cur.draft);
    setDraft(cur.draft);
    setLeft(left0);
    setStartedAt(cur.startedAt);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftReady, resumed, gameId]);

  // il tempo: si conta dall'orologio (non dai tick), così l'app in secondo piano non "regala" secondi
  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => {
      const l = Math.max(0, SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setLeft(l);
      if (l > 0) return;
      clearInterval(t);
      // scaduto: parte quello che c'è; se è vuoto si ricomincia
      if (!sendRef.current(draftRef.current)) {
        setNote(S.play.draw.timeUpEmpty);
        useDrawDraft.getState().clear(gameId);
        setStartedAt(null);
        setLeft(SECONDS);
      }
    }, 500);
    return () => clearInterval(t);
  }, [startedAt, gameId]);

  if (startedAt === null)
    return (
      <>
        <Sticker id="draw-word" fill={colors.butter} radius={28} offset={6} padding={22} tiltMax={1.5}>
          <View style={{ gap: 6 }}>
            <Text variant="caption">{S.play.draw.yourWord}</Text>
            <Text variant="hero" accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.2}>
              {word}
            </Text>
            <Text variant="body">{S.play.draw.ready}</Text>
          </View>
        </Sticker>
        {note ? (
          <Text variant="caption" color={colors.accentInk} accessibilityRole="alert">
            {note}
          </Text>
        ) : null}
        <Button
          label={S.play.draw.go}
          haptic="medium"
          onPress={() => {
            setNote(null);
            setResetKey((k) => k + 1);
            const t0 = Date.now();
            useDrawDraft.getState().begin(gameId, t0);
            setInitialDraft(null);
            setStartedAt(t0);
            setLeft(SECONDS);
          }}
        />
      </>
    );

  const done = sentFlag;
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Sticker id="draw-timer" fill={left <= 10 ? colors.accent : colors.butter} radius={18} offset={3} padding={10} tiltMax={1}>
          <Text variant="title" accessibilityLabel={S.play.draw.timeLabel(left)} accessibilityLiveRegion={left <= 10 ? "polite" : "none"}>
            {S.play.draw.time(left)}
          </Text>
        </Sticker>
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {word}
        </Text>
      </View>
      <SketchPad key={resetKey} size={size} locked={done || left === 0} onChange={onChange} initial={initialDraft} />
      {left === 0 && !done ? <Text variant="title">{S.play.draw.timeUp}</Text> : null}
      <Button label={S.play.draw.send} disabled={!draft || done} onPress={() => send(draft)} haptic="success" />
    </>
  );
}

/** Chi indovina: vede il disegno riprodotto, scrive la risposta (3 tentativi). */
function GuesserTurn({ source, game, d }: { source: GamesSource; game: GameRow; d: DrawData }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [text, setText] = useState("");
  const [replay, setReplay] = useState(0);
  // più piccola della tela di chi disegna: il campo della risposta deve stare sotto, senza scorrere
  const size = Math.min(width - PAGE_MARGIN * 2 - 6, 330);
  const attempts = d.guesses.length;
  const last = d.guesses[attempts - 1];
  const blocked = !!game.pending;
  const submit = (viaKeyboard = false) => {
    const t = text.trim();
    if (!t || blocked) return;
    if (viaKeyboard) haptics.light(); // dal bottone ci pensa il bottone: una sola aptica per azione
    play("tok");
    source.move(game.id, { type: "guess", text: t });
    setText("");
  };
  return (
    <>
      <Sticker id="draw-seen" fill={colors.white} radius={24} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: size }}>
        {d.drawing ? <DrawingReplay draw={d.drawing} size={size - outline.width * 2} replayKey={replay} /> : null}
      </Sticker>
      <Button label={S.play.draw.replay} variant="secondary" onPress={() => setReplay((k) => k + 1)} haptic="tick" />
      <View style={{ gap: 10 }}>
        <Text variant="title" accessibilityRole="header">
          {S.play.draw.guessHead(nameOf(source, d.drawer))}
        </Text>
        <Text variant="caption">{S.play.draw.attempt(Math.min(attempts + 1, DRAW_MAX_GUESSES), DRAW_MAX_GUESSES)}</Text>
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.slice(0, GUESS_MAX))}
          onSubmitEditing={() => submit(true)}
          placeholder={S.play.draw.placeholder}
          placeholderTextColor={colors.ink + "88"}
          accessibilityLabel={S.play.draw.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          maxLength={GUESS_MAX}
          style={{
            fontFamily: fonts.bodySemi,
            fontSize: 17,
            minHeight: 52,
            paddingHorizontal: 16,
            color: colors.ink,
            backgroundColor: colors.blushSoft,
            borderRadius: 16,
            borderWidth: outline.width,
            borderColor: colors.outline,
          }}
        />
        {last && !last.ok ? (
          <Text variant="bodyStrong" color={colors.accentInk} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {S.play.draw.wrong}
          </Text>
        ) : null}
        {attempts > 0 ? (
          <Text variant="caption">{`${S.play.draw.guessesSoFar}: ${d.guesses.map((g) => g.text).join(" · ")}`}</Text>
        ) : null}
        {blocked ? <Text variant="caption">{S.play.draw.checking}</Text> : null}
        <Button label={S.play.draw.guessBtn} disabled={!text.trim() || blocked} onPress={() => submit(false)} haptic="light" />
      </View>
    </>
  );
}

function Album({ source }: { source: GamesSource }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const items = source.games
    .filter((g) => g.kind === "draw" && g.status === "done" && (g.data as DrawData).drawing)
    .sort((a, b) => b.createdAt - a.createdAt);
  const cell = Math.floor((width - PAGE_MARGIN * 2 - 14) / 2);
  return (
    <View style={{ gap: 12 }}>
      <Text variant="title" accessibilityRole="header">
        {S.play.draw.album}
      </Text>
      {items.length === 0 ? (
        <Text variant="caption">{S.play.draw.albumEmpty}</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {items.map((g, i) => {
            const d = g.data as DrawData;
            const word = (g.result as { word?: string } | null)?.word ?? d.word ?? "";
            return (
              <Sticker
                key={g.id}
                id={`album-${g.id}`}
                fill={(g.result as { solved?: boolean } | null)?.solved ? colors.leafSoft : colors.blushSoft}
                radius={18}
                offset={3}
                padding={8}
                tiltMax={2}
                style={{ width: cell, marginTop: i % 2 === 1 ? 14 : 0 }}
                accessibilityLabel={S.play.draw.albumItem(word, nameOf(source, d.drawer))}
                accessibilityRole="image"
              >
                <View style={{ gap: 6, alignItems: "center" }}>
                  <View style={{ backgroundColor: colors.white, borderRadius: 12, borderWidth: outline.width, borderColor: colors.outline, overflow: "hidden" }}>
                    <NoteDrawingSvg strokes={d.drawing!.strokes} size={cell - 28} />
                  </View>
                  <Text variant="caption" numberOfLines={1}>
                    {word}
                  </Text>
                </View>
                {source.mode === "couple" ? (
                  <View style={{ marginTop: 6 }}>
                    <KeepButton id={g.id} kind="draw" source="game" caption={word} content={d.drawing!} />
                  </View>
                ) : null}
              </Sticker>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function DrawGame({ source, onBack }: { source: GamesSource; onBack: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const open = openGameOf(source.games, "draw");
  const closed = lastClosedOf(source.games, "draw");
  const game: GameRow | null = open ?? closed;
  const d = game?.data as DrawData | undefined;
  const turn = game ? whoseTurn(game, source.me) : "none";
  const word = (game && source.mine[game.id]?.word) || "";
  const imDrawer = d?.drawer === source.me;
  useGameReward(game, source.mode === "couple");
  useGameEndSound(game, source.me);
  const size = Math.min(width - PAGE_MARGIN * 2 - 6, 480);

  let body: React.ReactNode = null;
  if (!game || !d) body = <StartCard kind="draw" onStart={() => source.start("draw")} />;
  else if (game.status === "open") {
    if (imDrawer && d.phase === "drawing") body = <DrawerTurn key={game.id} source={source} game={game} word={word} />;
    else if (!imDrawer && d.phase === "drawing")
      body = (
        <Sticker id="draw-wait-d" fill={colors.skySoft} radius={24} offset={5} padding={18} tiltMax={1}>
          <View style={{ gap: 10, alignItems: "flex-start" }}>
            <Mascot size={88} mood="idle" />
            <Text variant="title">{S.play.draw.waitDrawing(source.partnerName)}</Text>
            {source.mode === "practice" ? <Text variant="caption">{`${S.play.practice.name} ${S.play.practice.thinking}`}</Text> : null}
          </View>
        </Sticker>
      );
    else if (!imDrawer && turn === "mine") body = <GuesserTurn source={source} game={game} d={d} />;
    else
      body = (
        <>
          <Text variant="title" accessibilityLiveRegion="polite">
            {S.play.draw.sentWait(source.partnerName)}
          </Text>
          <Sticker id="draw-mine" fill={colors.white} radius={24} offset={5} padding={0} tiltMax={0.8} faceStyle={{ width: size }}>
            {d.drawing ? <NoteDrawingSvg strokes={d.drawing.strokes} size={size - outline.width * 2} /> : null}
          </Sticker>
          {d.guesses.length ? (
            <Text variant="caption">{`${S.play.draw.guessesSoFar}: ${d.guesses.map((g) => g.text).join(" · ")}`}</Text>
          ) : null}
          <Text variant="caption">{`${S.play.draw.waitGuess(source.partnerName)}${source.mode === "practice" ? " " + S.play.practice.thinking : ""}`}</Text>
        </>
      );
  } else if (game.status === "done") {
    const r = game.result as { solved: boolean; word: string };
    body = (
      <>
        <Sticker id="draw-result" fill={r.solved ? colors.leaf : colors.blush} radius={28} offset={6} padding={20} tiltMax={1.5}>
          <Text variant="display" style={{ fontSize: 30, lineHeight: 32 }} accessibilityLiveRegion="polite">
            {r.solved ? S.play.draw.solved(r.word) : S.play.draw.failed(r.word)}
          </Text>
        </Sticker>
        <Sticker id="draw-final" fill={colors.white} radius={24} offset={5} padding={0} tiltMax={0.8} faceStyle={{ width: size }}>
          {d.drawing ? <DrawingReplay draw={d.drawing} size={size - outline.width * 2} replayKey={game.id} still /> : null}
        </Sticker>
        <Button label={S.play.next} onPress={() => source.start("draw")} haptic="medium" />
      </>
    );
  } else {
    body = (
      <>
        <Text variant="title">
          {(game.result as { by?: string } | null)?.by === source.me ? S.play.leftByMe : S.play.leftByThem(source.partnerName)}
        </Text>
        <Button label={S.play.next} onPress={() => source.start("draw")} haptic="medium" />
      </>
    );
  }

  return (
    <GameShell
      title={S.play.games.draw.name}
      onBack={onBack}
      practice={source.mode === "practice"}
      offline={source.offline}
      onLeave={open ? () => source.abandon(open.id) : undefined}
    >
      {body}
      <Album source={source} />
    </GameShell>
  );
}
