import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Button, Chip, Sticker, StickerPressable, Text, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { fonts, outline, PAGE_MARGIN, palette } from "@/design/tokens";
import { Frame } from "@/features/lab/widgets/kit";
import * as NV from "@/features/lab/widgets/noteViews";
import {
  BG_KEYS,
  type BgKey,
  INK_KEYS,
  type InkKey,
  NOTE_TEXT_MAX,
  type Note,
  buildDraw,
  cleanText,
  isDraw,
  noteState,
  pointsFromSvg,
  textInkFor,
  validateContent,
} from "@/lib/note/rules";
import { replayNote } from "@/lib/note/sync";
import type { NoteWidgetModel } from "@/lib/note/widgetModel";
import { S } from "@/lib/strings.it";
import { selectPairing, useCouple } from "@/state/coupleStore";

import { DrawCanvas, type Stroke } from "./DrawCanvas";
import { BG_HEX, INK_HEX, NoteDrawingSvg } from "./NoteArt";

/**
 * Disegna = "Manda sul blocco": un disegno (3-5 colori, due spessori) o una scritta di 80 caratteri finisce sul
 * widget Biglietto dell'altra persona (e sul tuo) per un'ora; chiunque dei due può "Pulire". Il disegno si manda come
 * vettori semplificati (src/lib/note/rules.ts). Anteprima viva di come lo vedrà il widget (piccolo, medio, blocco).
 */
const inkOf = (hex: string): InkKey => (INK_KEYS.find((k) => INK_HEX[k] === hex) ?? "ink") as InkKey;

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

export function DrawScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const pairing = useCouple(selectPairing);
  const partner = useCouple((s) => s.partnerName);
  const meName = useCouple((s) => s.meName);
  const available = useCouple((s) => s.noteAvailable);
  const noteServer = useCouple((s) => s.noteServer);
  const queue = useCouple((s) => s.queue);
  const sendNote = useCouple((s) => s.sendNote);
  const clearNote = useCouple((s) => s.clearNote);
  const link = useCouple((s) => s.link);
  const now = useNow(20_000);

  const [mode, setMode] = useState<"draw" | "text">("draw");
  const [pen, setPen] = useState<InkKey>("strawberry");
  const [thick, setThick] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<BgKey>("butter");
  const [justSent, setJustSent] = useState(false);
  const nextId = useRef(1);
  const inked = useSharedValue(0);

  const cw = Math.min(winW - PAGE_MARGIN * 2 - 6, 520);
  const inner = cw - outline.width * 2;

  const shown = useMemo(() => replayNote(noteServer, queue, meName), [noteServer, queue, meName]);
  const active = shown && noteState(shown, now) === "active" ? shown : null;

  const onCommit = useCallback((svg: string, color: string, isThick: boolean) => {
    setStrokes((s) => [...s, { id: nextId.current++, svg, color, thick: isThick }]);
  }, []);

  const hint = useAnimatedStyle(() => ({
    opacity: withTiming(inked.get() > 0 ? 0 : 1, { duration: 160 }),
  }));

  // Il contenuto che partirebbe adesso (anche per l'anteprima).
  const draft = useMemo(() => {
    if (mode === "text") {
      const t = cleanText(text);
      return t ? { kind: "text" as const, content: { text: t, bg } } : null;
    }
    if (!strokes.length) return null;
    const content = buildDraw(
      strokes.map((s) => ({ points: pointsFromSvg(s.svg), color: inkOf(s.color), thick: s.thick })),
      inner,
    );
    return { kind: "draw" as const, content };
  }, [mode, text, bg, strokes, inner]);

  const invalid = draft ? validateContent(draft.kind, draft.content) : null;
  const canSend = !!draft && !invalid && available !== false && pairing !== "unpaired";

  const send = () => {
    if (!draft || !canSend) return;
    const r = sendNote(draft.kind, draft.content);
    if (!r.ok) return;
    toast.show(link === "offline" ? S.draw.sentWaiting : S.draw.sent);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 3200);
    setStrokes([]);
    setText("");
    inked.set(0);
  };

  const model: NoteWidgetModel | null = draft
    ? {
        state: "note",
        note: {
          id: "bozza",
          kind: draft.kind,
          content: draft.content,
          by: "me",
          byName: meName,
          createdAt: now,
          expiresAt: now + 3_600_000,
          clearedAt: null,
        },
        byLine: S.note.byMe("adesso"),
        minutesLeft: 60,
      }
    : null;

  if (pairing === "unpaired")
    return (
      <Screen>
        <Text variant="display" accessibilityRole="header">
          {S.draw.title}
        </Text>
        <Sticker id="draw-unpaired" fill={colors.blushSoft} radius={24} offset={5} padding={18}>
          <View style={{ gap: 10 }}>
            <Text variant="title">{S.draw.unpairedTitle}</Text>
            <Text variant="body">{S.draw.unpairedBody}</Text>
            <Button label={S.tabs.us} variant="secondary" onPress={() => router.navigate("/(tabs)/us")} />
          </View>
        </Sticker>
      </Screen>
    );

  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        {S.draw.title}
      </Text>
      <Text variant="body">{S.draw.body(partner, pairing === "paired")}</Text>

      {available === false ? (
        <Sticker id="draw-unavailable" fill={colors.butterSoft} radius={20} offset={4} padding={14}>
          <Text variant="caption" accessibilityRole="alert">
            {S.draw.unavailable}
          </Text>
        </Sticker>
      ) : null}

      {active ? <ActiveNote note={active} now={now} onClear={() => { clearNote(); toast.show(S.draw.cleared); }} /> : null}

      <View style={{ flexDirection: "row", gap: 10 }} accessibilityRole="radiogroup">
        <Chip id="mode-draw" label={S.draw.modeDraw} selected={mode === "draw"} onPress={() => setMode("draw")} />
        <Chip id="mode-text" label={S.draw.modeText} selected={mode === "text"} onPress={() => setMode("text")} />
      </View>

      {mode === "draw" ? (
        <>
          <Sticker id="tela" fill={colors.white} radius={24} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: cw }}>
            <View style={{ width: inner, height: inner }}>
              <DrawCanvas
                color={INK_HEX[pen]}
                thick={thick}
                strokes={strokes}
                onCommit={onCommit}
                inked={inked}
                width={inner}
                height={inner}
              />
              <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 20, top: 20, right: 20 }, hint]}>
                <Text variant="title" color={colors.ink} style={{ opacity: 0.55 }}>
                  {S.draw.empty}
                </Text>
              </Animated.View>
            </View>
          </Sticker>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }} accessibilityRole="radiogroup">
            {INK_KEYS.map((k, i) => {
              const selected = k === pen;
              return (
                <StickerPressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={S.draw.pen(S.draw.pens[k])}
                  haptic="tick"
                  onPress={() => setPen(k)}
                  style={{ transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * 3}deg` }, { scale: selected ? 1.14 : 1 }] }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: INK_HEX[k],
                      borderWidth: outline.width,
                      borderColor: colors.outline,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected ? (
                      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: k === "ink" ? colors.white : colors.ink }} />
                    ) : null}
                  </View>
                </StickerPressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Chip id="w-thin" label={S.draw.thin} selected={!thick} onPress={() => setThick(false)} />
            <Chip id="w-thick" label={S.draw.thick} selected={thick} onPress={() => setThick(true)} />
            <Button label={S.draw.undo} variant="secondary" disabled={strokes.length === 0} onPress={() => setStrokes((s) => s.slice(0, -1))} haptic="light" />
            <Button label={S.draw.clear} variant="ghost" disabled={strokes.length === 0} onPress={() => setStrokes([])} haptic="medium" />
          </View>
        </>
      ) : (
        <>
          <Sticker id="testo" fill={BG_HEX[bg]} radius={24} offset={6} padding={0} tiltMax={0.8} faceStyle={{ width: cw }}>
            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, NOTE_TEXT_MAX * 2))}
              maxLength={NOTE_TEXT_MAX}
              multiline
              placeholder={S.draw.textPlaceholder}
              placeholderTextColor={colors.ink + "88"}
              accessibilityLabel={S.draw.textLabel}
              style={{
                fontFamily: fonts.display,
                fontSize: 30,
                lineHeight: 34,
                minHeight: 150,
                padding: 18,
                textAlignVertical: "top",
                color: palette[textInkFor(bg)],
              }}
            />
          </Sticker>
          <Text variant="caption" accessibilityLiveRegion="polite">
            {S.draw.counter([...text].length, NOTE_TEXT_MAX)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }} accessibilityRole="radiogroup">
            {BG_KEYS.map((k, i) => {
              const selected = k === bg;
              return (
                <StickerPressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={S.draw.bg(S.draw.bgs[k])}
                  haptic="tick"
                  onPress={() => setBg(k)}
                  style={{ transform: [{ rotate: `${(i % 2 === 0 ? -1 : 1) * 3}deg` }, { scale: selected ? 1.14 : 1 }] }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      backgroundColor: BG_HEX[k],
                      borderWidth: outline.width,
                      borderColor: colors.outline,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.ink }} /> : null}
                  </View>
                </StickerPressable>
              );
            })}
          </View>
        </>
      )}

      <View style={{ gap: 6 }}>
        <Button
          id="send-note"
          label={S.draw.send}
          haptic="success"
          disabled={!canSend}
          onPress={send}
          accessibilityHint={S.draw.sendLabel}
          fullWidth
        />
        {invalid ? (
          <Text variant="caption" color={colors.accentInk} accessibilityRole="alert">
            {S.draw.errorTooBig}
          </Text>
        ) : null}
        {justSent ? (
          <Sticker id="sent-ok" fill={colors.leaf} radius={999} offset={3} padding={0} tiltMax={1.5}>
            <Text variant="caption" style={{ paddingHorizontal: 14, paddingVertical: 8 }} accessibilityLiveRegion="polite">
              {link === "offline" ? S.draw.sentWaiting : S.draw.sent}
            </Text>
          </Sticker>
        ) : null}
      </View>

      <Text variant="caption">{S.draw.previewTitle}</Text>
      <View testID="note-preview" style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        {model ? (
          <>
            <View>
              <Text variant="caption">{S.draw.previewSmall}</Text>
              <Frame label="draft-small"><NV.NoteSmall m={model} /></Frame>
            </View>
            <View>
              <Text variant="caption">{S.draw.previewLock}</Text>
              <View style={{ marginTop: 4 }}>
                <NV.NoteLock m={model} />
              </View>
            </View>
            <View>
              <Text variant="caption">{S.draw.previewMedium}</Text>
              <Frame w={321} label="draft-medium"><NV.NoteMedium m={model} /></Frame>
            </View>
          </>
        ) : (
          <Text variant="body" style={{ opacity: 0.6 }}>
            {S.draw.nothing}
          </Text>
        )}
      </View>
    </Screen>
  );
}

/** Il biglietto che c'è sul blocco adesso, con "sparisce tra 52 min" e Pulisci (lo possono usare entrambi). */
function ActiveNote({ note, now, onClear }: { note: Note; now: number; onClear: () => void }) {
  const { colors } = useTheme();
  const left = Math.max(0, Math.ceil((note.expiresAt - now) / 60000));
  const fromMe = note.by === "me";
  return (
    <Sticker id="active-note" fill={colors.butterSoft} radius={24} offset={5} padding={14} tiltMax={1}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }} accessibilityLabel={`${S.draw.activeTitle}. ${S.draw.from(fromMe ? null : note.byName)}. ${S.draw.leaves(left)}`}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 14,
            borderWidth: outline.width,
            borderColor: colors.outline,
            backgroundColor: isDraw(note.content) ? colors.white : BG_HEX[note.content.bg],
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {isDraw(note.content) ? (
            <NoteDrawingSvg strokes={note.content.strokes} size={72} />
          ) : (
            <Text variant="caption" numberOfLines={4} color={palette[textInkFor(note.content.bg)]} style={{ padding: 6, fontFamily: fonts.display }}>
              {note.content.text}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption">{S.draw.activeTitle}</Text>
          <Text variant="bodyStrong">{S.draw.from(fromMe ? null : note.byName || "lei")}</Text>
          <Text variant="caption">{note.pending ? S.draw.waiting : S.draw.leaves(left)}</Text>
        </View>
        <Button label={S.draw.clearBtn} variant="secondary" haptic="medium" onPress={onClear} accessibilityHint={S.draw.clearLabel} />
      </View>
    </Sticker>
  );
}
