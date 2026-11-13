import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, View } from "react-native";
import { useAnimatedRef } from "react-native-reanimated";

import { Button, Icon, Skeleton, Sticker, Text, useEffectsBus, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import type { PetFace } from "@/design/mascot/PetArt";
import { palette } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { type FoodId, SLEEP_MS, stageProgress } from "@/lib/pet/rules";
import { S } from "@/lib/strings.it";
import { useCouple } from "@/state/coupleStore";

import { FoodTray } from "./FoodTray";
import { Glyph } from "./Glyphs";
import { NameSheet } from "./NameSheet";
import { NeedStickers } from "./NeedStickers";
import { PetLog } from "./PetLog";
import { PetStageView, type PetReaction } from "./PetStage";
import { PlaySheet } from "./PlaySheet";
import { usePet } from "./usePet";

/**
 * Pet condiviso. Un solo elemento dominante: il pet. Sotto, tre adesivi per i bisogni, quattro azioni, le ultime cure.
 * Stati: non collegati (uovo che aspetta), server non pronto, caricamento, uovo (si schiude toccandolo in due),
 * pet. Tutto ciò che fate parte subito (ottimistico) e viaggia in coda, anche senza rete.
 */
export function PetScreen() {
  const hydrated = useCouple((s) => s.hydrated);
  const coupleId = useCouple((s) => s.coupleId);
  const petAvailable = useCouple((s) => s.petAvailable);
  const link = useCouple((s) => s.link);
  const hasPet = useCouple((s) => s.petServer !== null);
  if (!hydrated) return <PetSkeleton />;
  if (!coupleId) return <PetSide kind="unpaired" />;
  if (petAvailable === false) return <PetSide kind="unavailable" />;
  // Collegati ma il server non ha ancora risposto: scheletro. Se siamo offline si può comunque toccare (va in coda).
  if (petAvailable === null && !hasPet && link !== "offline") return <PetSkeleton />;
  return <PetMain />;
}

function PetSkeleton() {
  return (
    <Screen>
      <View accessible accessibilityLabel={S.pet.loading} style={{ gap: 20 }}>
        <Skeleton width="60%" height={40} />
        <Skeleton height={300} radius={32} />
        <Skeleton height={64} radius={24} />
      </View>
    </Screen>
  );
}

/** Non collegati / server non pronto: l'uovo che aspetta. */
function PetSide({ kind }: { kind: "unpaired" | "unavailable" }) {
  const router = useRouter();
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const [count, setCount] = useState(0);
  const poke = () => {
    haptics.light();
    const n = count + 1;
    setCount(n);
    setReaction({ face: "surprised", nonce: n });
  };
  const line = count === 0 ? S.pet.eggBody : S.pet.eggPoked[(count - 1) % S.pet.eggPoked.length]!;
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {kind === "unpaired" ? S.pet.unpairedTitle : S.pet.unavailableTitle}
      </Text>
      <PetStageView
        stage="egg"
        mood="egg"
        reaction={reaction}
        caress={false}
        onPoke={poke}
        a11yLabel={S.pet.a11y.egg}
      />
      <Text variant="body" accessibilityLiveRegion="polite">
        {kind === "unpaired" ? S.pet.unpairedBody : S.pet.unavailableBody}
      </Text>
      <Text variant="caption">{line}</Text>
      {kind === "unpaired" ? (
        <Button label={S.pet.unpairedCta} onPress={() => router.push("/(tabs)/us")} />
      ) : null}
    </Screen>
  );
}

const ACTION_LOOK = {
  feed: { fill: palette.butter, tilt: -1.5 },
  cuddle: { fill: palette.blush, tilt: 1 },
  play: { fill: palette.leaf, tilt: -0.5 },
  sleep: { fill: palette.sky, tilt: 1.5 },
} as const;

function ActionButton({
  kind,
  onPress,
  active,
}: {
  kind: keyof typeof ACTION_LOOK;
  onPress: () => void;
  active?: boolean;
}) {
  const look = ACTION_LOOK[kind];
  const label = S.pet.actions[kind];
  return (
    <View style={{ flex: 1 }}>
      <Sticker
        id={`act-${kind}`}
        fill={look.fill}
        radius={22}
        offset={active ? 2 : 4}
        padding={8}
        tiltMax={0}
        onPress={onPress}
        haptic={kind === "sleep" ? "success" : "light"}
        accessibilityLabel={label}
        accessibilityRole="button"
        style={{ transform: [{ rotate: `${look.tilt}deg` }] }}
        faceStyle={{ alignItems: "center", gap: 2, minHeight: 78, justifyContent: "center" }}
      >
        {kind === "cuddle" ? (
          <Glyph kind="love" size={30} fill={palette.strawberry} id="act-cuddle" />
        ) : kind === "sleep" ? (
          <Glyph kind="energy" size={30} fill={palette.butter} id="act-sleep" />
        ) : kind === "play" ? (
          <Glyph kind="play" size={30} fill={palette.butterSoft} id="act-play" />
        ) : (
          <Glyph kind="food" size={30} fill={palette.strawberry} id="act-feed" />
        )}
        <Text variant="caption" align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
      </Sticker>
    </View>
  );
}

function PetMain() {
  const { colors } = useTheme();
  const toast = useToast();
  const { pet, mood, needs, stage, log, now, queued, hatched } = usePet();
  const members = useCouple((s) => s.members);
  const partnerName = useCouple((s) => s.partnerName);
  const meId = useCouple((s) => s.userId);
  const myRole = useCouple((s) => s.myRole);
  const link = useCouple((s) => s.link);
  const petAvailable = useCouple((s) => s.petAvailable);
  const incomingSeq = useCouple((s) => s.petIncomingSeq);
  const petAct = useCouple((s) => s.petAct);
  const touchEgg = useCouple((s) => s.touchEgg);
  const setPetName = useCouple((s) => s.setPetName);

  const petRef = useAnimatedRef<View>();
  const [reaction, setReaction] = useState<PetReaction | null>(null);
  const nonce = useRef(0);
  const react = useCallback((face: PetFace) => {
    nonce.current += 1;
    setReaction({ face, nonce: nonce.current });
  }, []);
  const [tray, setTray] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pokes, setPokes] = useState(0);

  const say = useCallback((t: string) => {
    setNote(t);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2200);
  }, []);
  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  // La schiusa è un momento raro: coriandoli, e chi l'ha fatto nascere sceglie il nome.
  // Solo se l'uovo era davvero visto come uovo (dati del server già arrivati): caricare un pet già nato non è una schiusa.
  const sawEgg = useRef(false);
  useEffect(() => {
    if (!hatched && petAvailable === true) sawEgg.current = true;
    if (!hatched || !sawEgg.current) return;
    sawEgg.current = false;
    const { width, height } = Dimensions.get("window");
    useEffectsBus.getState().fireConfetti(width / 2, height * 0.3);
    haptics.success();
    // un attimo dopo i coriandoli: prima la festa, poi la domanda del nome
    const t = setTimeout(() => {
      react("happy");
      if (pet.hatchedBy === meId) setNameOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [hatched, petAvailable, pet.hatchedBy, meId, react]);

  // L'altra persona cura il pet mentre sei qui: il pet reagisce (il toast lo mostra la radice dell'app).
  const lastIncoming = useRef(incomingSeq);
  useEffect(() => {
    if (incomingSeq === lastIncoming.current) return;
    lastIncoming.current = incomingSeq;
    const k = useCouple.getState().petIncoming?.kind;
    if (k === "feed") react("eat");
    else if (k === "cuddle") react("love");
    else if (k === "play") react("happy");
  }, [incomingSeq, react]);

  const petName = pet.name ?? S.pet.defaultName;
  const touchesMine = myRole === "a" ? pet.touchesA : pet.touchesB;
  const touchesTheirs = myRole === "a" ? pet.touchesB : pet.touchesA;
  const total = pet.touchesA + pet.touchesB;
  const crack = total >= 6 ? 3 : total >= 3 ? 2 : total >= 1 ? 1 : 0;

  const result = (r: ReturnType<typeof petAct>) => {
    if (r.ok) return true;
    haptics.light();
    if (r.error === "cooldown") say(S.pet.wait);
    return false;
  };
  const feed = (id: FoodId) => {
    if (result(petAct("feed", id))) react("eat");
  };
  const cuddle = () => {
    if (result(petAct("cuddle"))) {
      react("love");
      const { width, height } = Dimensions.get("window");
      useEffectsBus.getState().fireHearts(width / 2, height * 0.34);
    }
  };
  const caressDone = () => {
    haptics.success();
    cuddle();
  };
  const sleep = () => {
    if (result(petAct("sleep"))) setTray(false);
  };

  const poke = () => {
    if (!hatched) {
      haptics.light();
      touchEgg();
      react("surprised");
      setPokes((n) => n + 1);
      return;
    }
    haptics.light();
    react(mood === "asleep" || mood === "away" ? "surprised" : "happy");
  };

  const line = note ?? (hatched ? S.pet.say[mood] : pokes === 0 ? S.pet.eggBody : S.pet.eggPoked[(pokes - 1) % S.pet.eggPoked.length]!);
  const prog = hatched ? stageProgress(pet) : null;
  const nextStage = prog ? (stage === "seed" ? "sprout" : stage === "sprout" ? "berry" : "big") : null;
  const asleep = hatched && now < pet.sleepUntil;
  const sleepMinutes = Math.max(0, Math.ceil((pet.sleepUntil - now) / 60000));

  return (
    <Screen>
      {hatched ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S.pet.a11y.rename(petName)}
          onPress={() => setNameOpen(true)}
          hitSlop={8}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text variant="display" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {petName}
          </Text>
          <Text variant="caption" color={colors.ink + "a6"}>
            {S.pet.stages[stage]}
          </Text>
        </Pressable>
      ) : (
        <Text variant="display" accessibilityRole="header">
          {S.pet.eggTitle}
        </Text>
      )}

      <PetStageView
        stage={stage}
        mood={mood}
        crack={crack}
        reaction={reaction}
        caress={hatched}
        onCaress={caressDone}
        onPoke={poke}
        petRef={petRef}
        a11yLabel={hatched ? S.pet.a11y.pet(petName, S.pet.say[mood], S.pet.stages[stage]) : S.pet.a11y.egg}
        a11yHint={hatched ? S.pet.cuddleHint : undefined}
      />

      {hatched && tray ? <FoodTray petRef={petRef} onFeed={feed} /> : null}

      <Sticker
        id="pet-parla"
        fill={colors.butter}
        radius={22}
        offset={4}
        padding={14}
        tiltMax={2}
        style={{ alignSelf: "flex-end", maxWidth: "88%" }}
        accessibilityRole="text"
      >
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">
          {asleep ? S.pet.sleepOn(sleepMinutes) : line}
        </Text>
      </Sticker>

      {!hatched ? (
        <View style={{ gap: 10 }}>
          <TouchLine done={touchesMine > 0} text={touchesMine > 0 ? S.pet.eggMe : S.pet.eggMeNot} />
          <TouchLine done={touchesTheirs > 0} text={touchesTheirs > 0 ? S.pet.eggThem(partnerName) : S.pet.eggThemNot(partnerName)} />
          {members.length < 2 ? <Text variant="caption">{S.pet.eggWaiting}</Text> : null}
        </View>
      ) : (
        <>
          <NeedStickers needs={needs} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionButton kind="feed" active={tray} onPress={() => setTray((v) => !v)} />
            <ActionButton kind="cuddle" onPress={cuddle} />
            <ActionButton kind="play" onPress={() => setPlayOpen(true)} />
            <ActionButton kind="sleep" onPress={sleep} />
          </View>
          <PetLog entries={log} me={meId} members={members} partnerName={partnerName} now={now} />
          <View style={{ gap: 4 }}>
            {prog && nextStage ? (
              <Text variant="bodyStrong">{S.pet.progress(prog.to - prog.points, S.pet.stages[nextStage])}</Text>
            ) : (
              <Text variant="bodyStrong">{S.pet.maxStage}</Text>
            )}
            <Text variant="caption">{S.pet.progressHint}</Text>
          </View>
        </>
      )}
      {queued > 0 && link !== "live" ? <Text variant="caption">{S.pet.queued(queued)}</Text> : null}

      <PlaySheet
        visible={playOpen}
        onClose={() => setPlayOpen(false)}
        onWin={() => {
          if (result(petAct("play"))) react("happy");
        }}
      />
      <NameSheet
        visible={nameOpen}
        onClose={() => setNameOpen(false)}
        current={pet.name}
        partnerName={partnerName}
        onSave={(n) => {
          setPetName(n);
          toast.show(S.pet.toast.name(n));
        }}
      />
    </Screen>
  );
}

function TouchLine({ done, text }: { done: boolean; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessible accessibilityRole="text" accessibilityLabel={text}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2.5,
          borderColor: colors.outline,
          backgroundColor: done ? colors.leaf : colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done ? <Icon name="check" size={16} color={colors.ink} /> : null}
      </View>
      <Text variant="bodyStrong">{text}</Text>
    </View>
  );
}

export const PET_NAP_MS = SLEEP_MS;
