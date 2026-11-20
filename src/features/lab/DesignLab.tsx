import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  Avatar,
  Badge,
  Button,
  Chip,
  EmptyState,
  Icon,
  type IconName,
  Mascot,
  type MascotMood,
  MoodSticker,
  Sheet,
  Skeleton,
  Sparkle,
  Sticker,
  StickerSwitch,
  Text,
  palette,
  useEffectsBus,
  useTheme,
  useToast,
  motion,
  type,
  shadowOffset,
  space,
  radius,
} from "@/design";
import { Screen } from "@/design/layout/Screen";
import { MOOD_IDS } from "@/features/home/moods";
import { play, type SoundId } from "@/lib/sound";
import { S } from "@/lib/strings.it";
import { useSettings } from "@/state/settingsStore";

/** Laboratorio del design (nascosto: 5 tocchi sul titolo della Home). Mostra ogni componente, stato, colore, misura e token di movimento. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

const LAB_SOUNDS: { id: SoundId; label: string }[] = [
  { id: "pop", label: "Penso a te" },
  { id: "plink", label: "Umore" },
  { id: "paper", label: "Biglietto" },
  { id: "chew", label: "Pet mangia" },
  { id: "carezza", label: "Carezza" },
  { id: "snore", label: "Nanna" },
  { id: "grow", label: "Cresce" },
  { id: "fanfara", label: "Schiusa / vittoria" },
  { id: "tok", label: "Mossa" },
  { id: "pareggio", label: "Pareggio" },
  { id: "rivela", label: "Rivela" },
  { id: "scatto", label: "Foto" },
  { id: "festa", label: "Collegati" },
];

/** Provoca un errore di disegno per provare la schermata "Qualcosa si è incastrato". */
function Bomb(): React.ReactElement {
  throw new Error("Errore di prova (laboratorio)");
}

/** Casi peggiori: i dati più scomodi che l'app può ricevere, nei componenti veri. */
const LONG_NAME = "Bartolomeo-Maria Alessandro de' Medici 🍓💖🧁";
const T280 =
  "Questa è una risposta lunghissima, di quelle che si scrivono quando si ha tanto da dire e non ci si vuole fermare: parla del mare, della montagna, del treno delle sette e dieci, di quella sera in cui pioveva e noi due sotto lo stesso ombrello a ridere come matti, e di tutte le cose piccole che rendono bella una giornata qualunque, anche questa.";

function WorstCase() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Sticker id="w-nome" fill={colors.blush} radius={28} offset={5} padding={16} tiltMax={1}>
        <View style={{ gap: 6 }}>
          <Avatar name={LONG_NAME} size={56} fill={colors.butter} />
          <Text variant="display" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
            {LONG_NAME}
          </Text>
          <Text variant="bodyStrong">{`Insieme dal 1 gennaio 2099 · 0 giorni`}</Text>
        </View>
      </Sticker>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Sticker id="w-n0" fill={colors.accent} radius={26} offset={4} padding={14} style={{ flex: 1 }}>
          <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            0
          </Text>
        </Sticker>
        <Sticker id="w-n9999" fill={colors.sky} radius={26} offset={4} padding={14} style={{ flex: 1.4 }}>
          <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            9999
          </Text>
        </Sticker>
      </View>
      <Sticker id="w-testo" fill={colors.surface} radius={22} offset={4} padding={14}>
        <Text variant="body">{T280}</Text>
      </Sticker>
      <Chip label={`${LONG_NAME} — un'etichetta lunghissima`} selected={false} onPress={() => {}} />
      <Button label="Un bottone con un testo davvero molto molto lungo da leggere" variant="secondary" fullWidth />
    </View>
  );
}

function MotionDemo({
  label,
  config,
}: {
  label: string;
  config: { duration: number; dampingRatio: number } | "easeOut" | "easeInOut";
}) {
  const { colors } = useTheme();
  const x = useSharedValue(0);
  const on = useSharedValue(false);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <Sticker
      id={`motion-${label}`}
      fill={colors.surface}
      radius={18}
      offset={3}
      padding={12}
      tiltMax={0.5}
      onPress={() => {
        on.set(!on.get());
        const target = on.get() ? 150 : 0;
        if (config === "easeOut")
          x.set(withTiming(target, { duration: 400, easing: motion.easeOut }));
        else if (config === "easeInOut")
          x.set(withTiming(target, { duration: 400, easing: motion.easeInOut }));
        else x.set(withSpring(target, config));
      }}
      accessibilityLabel={label}
    >
      <View style={{ gap: 8 }}>
        <Text variant="caption">{label}</Text>
        <View style={{ height: 36, justifyContent: "center" }}>
          <Animated.View
            style={[
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accent,
                borderWidth: 2.5,
                borderColor: colors.ink,
              },
              style,
            ]}
          />
        </View>
      </View>
    </Sticker>
  );
}

const SWATCHES: [string, string][] = [
  ["ink", palette.ink],
  ["paper", palette.paper],
  ["strawberry", palette.strawberry],
  ["strawberryDeep", palette.strawberryDeep],
  ["leaf", palette.leaf],
  ["sky", palette.sky],
  ["butter", palette.butter],
  ["blush", palette.blush],
  ["blushSoft", palette.blushSoft],
  ["skySoft", palette.skySoft],
  ["butterSoft", palette.butterSoft],
  ["leafSoft", palette.leafSoft],
];
const ICONS: IconName[] = [
  "home",
  "pet",
  "draw",
  "play",
  "us",
  "heart",
  "plus",
  "settings",
  "check",
  "close",
];
const MOODS: MascotMood[] = ["idle", "happy", "sleepy", "surprised", "love"];

export function DesignLab() {
  const router = useRouter();
  const { colors, dark } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [bomb, setBomb] = useState(false);
  const [chip, setChip] = useState(0);
  const reduce = useSettings((s) => s.reduceMotionOverride);
  const setReduce = useSettings((s) => s.setReduceMotionOverride);
  const setDark = useSettings((s) => s.setDarkOverride);

  return (
    <Screen tabBar={false}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text variant="display" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {S.lab.title}
        </Text>
        <Button label={S.common.close} variant="secondary" onPress={() => router.back()} />
      </View>

      <Sticker
        id="lab-toggles"
        fill={colors.butterSoft}
        radius={24}
        offset={4}
        padding={16}
        tiltMax={0.8}
      >
        <View style={{ gap: 14 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text variant="bodyStrong">{S.us.reduceMotion}</Text>
            <StickerSwitch
              value={reduce === true}
              onChange={(v) => setReduce(v ? true : null)}
              label={S.us.reduceMotion}
            />
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text variant="bodyStrong">Tema scuro (token)</Text>
            <StickerSwitch value={dark} onChange={setDark} label="Tema scuro" />
          </View>
        </View>
      </Sticker>

      <Section title="Colori">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {SWATCHES.map(([name, hex]) => (
            <Sticker
              key={name}
              id={`sw-${name}`}
              fill={hex}
              radius={16}
              offset={3}
              padding={0}
              tiltMax={1.5}
              accessibilityLabel={`${name} ${hex}`}
            >
              <View style={{ width: 96, height: 76, padding: 8, justifyContent: "flex-end" }}>
                <Text
                  variant="caption"
                  color={["ink", "strawberryDeep"].includes(name) ? palette.paper : palette.ink}
                  style={{ fontSize: 12, lineHeight: 14 }}
                  maxFontSizeMultiplier={1.2}
                >
                  {name}
                </Text>
                <Text
                  variant="caption"
                  color={["ink", "strawberryDeep"].includes(name) ? palette.paper : palette.ink}
                  style={{ fontSize: 11, lineHeight: 13 }}
                  maxFontSizeMultiplier={1.2}
                >
                  {hex}
                </Text>
              </View>
            </Sticker>
          ))}
        </View>
      </Section>

      <Section title="Tipografia">
        {(Object.keys(type) as (keyof typeof type)[]).map((v) => (
          <View key={v}>
            <Text variant="caption">{`${v} · ${type[v].size}pt · interlinea ${type[v].line} · tracking ${type[v].tracking}em`}</Text>
            <Text variant={v} numberOfLines={2}>
              Penso a te, Giorni insieme
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Bottoni">
        <View style={{ gap: 14 }}>
          <Button label="Primario" onPress={() => toast.show("Primario premuto")} />
          <Button label="Secondario" variant="secondary" icon="heart" />
          <Button label="Fantasma" variant="ghost" />
          <Button label="Disattivato" disabled />
        </View>
      </Section>

      <Section title="Adesivi, chip, avatar, badge">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <Sticker id="s1" fill={colors.butter} padding={14}>
            <Text variant="bodyStrong">Piatto, ombra dura</Text>
          </Sticker>
          <Sticker
            id="s2"
            fill={colors.sky}
            padding={14}
            onPress={() => {}}
            accessibilityLabel="Adesivo premibile"
          >
            <Text variant="bodyStrong">Premimi</Text>
          </Sticker>
          <Sticker id="s3" fill={colors.blush} padding={14} offset={0}>
            <Text variant="bodyStrong">Senza ombra</Text>
          </Sticker>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {["Pizza", "Sushi", "Divano"].map((l, i) => (
            <Chip key={l} label={l} selected={chip === i} onPress={() => setChip(i)} />
          ))}
          <Avatar name="Nikole" fill={colors.sky} />
          <Avatar name="Leonardo" />
          <Badge value={3} />
          <Badge value="99+" fill={colors.accent} />
        </View>
      </Section>

      <Section title="Mascotte">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {MOODS.map((m) => (
            <View key={m} style={{ alignItems: "center" }}>
              <Mascot size={96} mood={m} />
              <Text variant="caption">{m}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Adesivi umore">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {MOOD_IDS.map((m) => (
            <MoodSticker key={m} mood={m} size={68} />
          ))}
        </View>
      </Section>

      <Section title="Icone">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {ICONS.map((n) => (
            <Icon key={n} name={n} size={32} fill={colors.blush} />
          ))}
        </View>
      </Section>

      <Section title="Effetti">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <Button
            label="Cuori"
            variant="secondary"
            onPress={(e) =>
              useEffectsBus.getState().fireHearts(e.nativeEvent.pageX, e.nativeEvent.pageY)
            }
            haptic="success"
          />
          <Button
            label="Coriandoli"
            variant="secondary"
            onPress={() => useEffectsBus.getState().fireConfetti()}
            haptic="success"
          />
          <Sparkle size={28} />
          <Sparkle size={18} delay={300} color={palette.strawberry} />
        </View>
      </Section>

      <Section title="Suoni (con l'interruttore silenzioso spento)">
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {LAB_SOUNDS.map((x) => (
            <Chip key={x.id} label={x.label} selected={false} onPress={() => play(x.id)} />
          ))}
        </View>
      </Section>

      <Section title="Casi peggiori">
        <WorstCase />
      </Section>

      <Section title="Errore di prova">
        <Button label="Provoca un errore" variant="secondary" onPress={() => setBomb(true)} />
        {bomb ? <Bomb /> : null}
      </Section>

      <Section title="Sheet, toast, scheletri, stato vuoto">
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Button label="Apri sheet" variant="secondary" onPress={() => setSheet(true)} />
          <Button
            label="Mostra toast"
            variant="secondary"
            onPress={() => toast.show(S.toast.saved)}
          />
        </View>
        <Skeleton height={28} width="70%" />
        <Skeleton height={64} radius={20} />
        <EmptyState
          title="Niente da vedere"
          body="Qui comparirà qualcosa appena succede qualcosa."
          actionLabel="Ok"
        />
      </Section>

      <Section title="Movimento (tocca le carte)">
        <MotionDemo label="spring 400 / 1.0 (default)" config={motion.spring} />
        <MotionDemo label="spring 300 / 0.8 (sheet)" config={motion.springSheet} />
        <MotionDemo label="spring 450 / 0.5 (rimbalzo)" config={motion.springBouncy} />
        <MotionDemo label="bezier(0.23, 1, 0.32, 1)" config="easeOut" />
        <MotionDemo label="bezier(0.77, 0, 0.175, 1)" config="easeInOut" />
        <Text variant="caption">{`press ${motion.duration.press}ms · enter ${motion.duration.enter}ms · exit ${motion.duration.exit}ms · stagger ${motion.stagger}ms · scala premuto ${motion.pressScale}`}</Text>
        <Text variant="caption">{`ombra ${shadowOffset.sm}/${shadowOffset.md}/${shadowOffset.lg}px · spazi ${Object.values(space).join("/")} · raggi ${Object.values(radius).join("/")}`}</Text>
      </Section>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Sheet">
        <Text variant="body" style={{ marginBottom: 12 }}>
          Trascinala in basso, oppure dai un colpo di dito. Oltre il bordo alto fa resistenza.
        </Text>
        <Button label={S.common.close} onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}
