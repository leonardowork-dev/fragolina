import React, { useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";

import { Button, Icon, Sticker, Text, TextField, useEffectsBus, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { fonts, outline, radius } from "@/design/tokens";
import { haptics } from "@/lib/haptics";
import { answerText, dayQuestion } from "@/lib/qa/legacy";
import { ANSWER_MAX, TOMORROW_MAX, archiveOf } from "@/lib/qa/rules";
import { S } from "@/lib/strings.it";
import { formatLongDate } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { PageHeader } from "../common/PageHeader";
import { FlipPair } from "./FlipPair";
import { useQa } from "./useQa";

function AnswerBox({ onSend, partner, theirsAnswered }: { onSend: (t: string) => void; partner: string; theirsAnswered: boolean }) {
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const left = ANSWER_MAX - text.length;
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        testID="qa-input"
        value={text}
        onChangeText={(t) => setText(t.slice(0, ANSWER_MAX))}
        placeholder={S.qa.placeholder}
        placeholderTextColor={colors.ink + "66"}
        accessibilityLabel={S.qa.a11yAnswer}
        multiline
        maxLength={ANSWER_MAX}
        autoCapitalize="sentences"
        textAlignVertical="top"
        style={{
          fontFamily: fonts.bodySemi,
          fontSize: 17,
          minHeight: 140,
          padding: 16,
          color: colors.ink,
          backgroundColor: colors.blushSoft,
          borderRadius: 20,
          borderWidth: outline.width,
          borderColor: colors.outline,
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <Text variant="caption" style={{ flex: 1 }}>
          {theirsAnswered ? S.qa.secretDone(partner) : S.qa.secret(partner)}
        </Text>
        <Text variant="caption" color={left < 20 ? colors.accentInk : undefined}>
          {S.qa.counter(text.length, ANSWER_MAX)}
        </Text>
      </View>
      <Button id="qa-send" label={S.qa.send} haptic="success" disabled={!text.trim()} onPress={() => onSend(text)} fullWidth />
    </View>
  );
}

function Tomorrow() {
  const { colors } = useTheme();
  const toast = useToast();
  const partner = useCouple((s) => s.partnerName);
  const qaTomorrow = useCouple((s) => s.qaTomorrow);
  const { tomorrowTurn, tomorrowCustom, tomorrowByMe, days, tomorrow } = useQa();
  const theirsWritten = !tomorrowByMe && days.some((d) => d.day === tomorrow && d.ref === "custom");
  const [text, setText] = useState("");
  return (
    <Sticker id="qa-domani" fill={colors.skySoft} radius={24} offset={4} padding={16} tiltMax={1} style={{ marginRight: 14 }}>
      <View style={{ gap: 10 }}>
        <Text variant="title" accessibilityRole="header">
          {S.qa.tomorrowTitle}
        </Text>
        {tomorrowTurn ? (
          <>
            <Text variant="bodyStrong">{S.qa.myTurn}</Text>
            {tomorrowCustom && tomorrowByMe ? (
              <Text variant="body" testID="qa-tomorrow-mine">
                {`${S.qa.tomorrowYours} ${tomorrowCustom}`}
              </Text>
            ) : (
              <Text variant="caption">{S.qa.myTurnHint}</Text>
            )}
            <TextField label={S.qa.tomorrowTitle} value={text} onChange={setText} maxLength={TOMORROW_MAX} placeholder={S.qa.tomorrowPlaceholder} autoCapitalize="sentences" multiline minHeight={84} />
            <Button
              id="qa-tomorrow-save"
              label={S.qa.tomorrowSave}
              variant="secondary"
              disabled={text.trim().length < 3}
              haptic="success"
              onPress={() => {
                const r = qaTomorrow(text);
                if (r.ok) {
                  toast.show(S.qa.tomorrowSaved);
                  setText("");
                }
              }}
            />
          </>
        ) : (
          <Text variant="bodyStrong">{theirsWritten ? S.qa.theirDone(partner) : S.qa.theirTurn(partner)}</Text>
        )}
      </View>
    </Sticker>
  );
}

function Archive() {
  const { colors } = useTheme();
  const partner = useCouple((s) => s.partnerName);
  const { days, today } = useQa();
  const [q, setQ] = useState("");
  const list = useMemo(
    () => archiveOf(days, today, dayQuestion, q, (d, c) => answerText(d, { text: "", choice: c })),
    [days, today, q],
  );
  return (
    <View style={{ gap: 12 }}>
      <Text variant="display" accessibilityRole="header">
        {S.qa.archiveTitle}
      </Text>
      <Text variant="caption">{S.qa.archiveHint}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label={S.qa.searchLabel} value={q} onChange={setQ} maxLength={40} placeholder={S.qa.searchPlaceholder} autoCapitalize="none" />
        </View>
        <View style={{ marginTop: 22 }}>
          <Icon name="search" size={26} />
        </View>
      </View>
      {list.length === 0 ? (
        <Text variant="body" testID="qa-archive-empty">
          {q.trim() ? S.qa.searchEmpty : S.qa.archiveEmpty}
        </Text>
      ) : (
        list.map((d, i) => (
          <Sticker key={d.day} id={`arch-${d.day}`} fill={i % 2 ? colors.blushSoft : colors.surface} radius={20} offset={3} padding={14} tiltMax={1.2} style={{ marginRight: i % 2 ? 0 : 12, marginLeft: i % 2 ? 12 : 0 }} testID={`archive-${d.day}`}>
            <View style={{ gap: 8 }}>
              <Text variant="caption">{formatLongDate(d.day)}</Text>
              <Text variant="bodyStrong">{dayQuestion(d)}</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: colors.leafSoft, borderRadius: 14, padding: 10, borderWidth: 2, borderColor: colors.outline }}>
                  <Text variant="caption">{S.qa.yours}</Text>
                  <Text variant="body">{d.mine ? answerText(d, d.mine) : ""}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.skySoft, borderRadius: 14, padding: 10, borderWidth: 2, borderColor: colors.outline }}>
                  <Text variant="caption">{S.qa.theirs(partner)}</Text>
                  <Text variant="body">{d.theirs ? answerText(d, d.theirs) : S.qa.archiveWaiting(partner)}</Text>
                </View>
              </View>
              {d.mine && d.mine.choice ? <Text variant="caption">{S.qa.legacyNote}</Text> : null}
            </View>
          </Sticker>
        ))
      )}
    </View>
  );
}

/** La domanda di oggi: risposta libera (max 280), carta che si gira con le due risposte affiancate, domanda di domani, archivio. */
export function QuestionScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const partner = useCouple((s) => s.partnerName);
  const paired = useCouple((s) => s.members.length >= 2);
  const available = useCouple((s) => s.extraAvailable);
  const refresh = useCouple((s) => s.refreshExtra);
  const answer = useCouple((s) => s.qaAnswer);
  const revealedDay = useCouple((s) => s.qaRevealedDay);
  const markRevealed = useCouple((s) => s.markQaRevealed);
  const link = useCouple((s) => s.link);
  const { day, text, pendingAnswer } = useQa();
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const mine = day.mine;
  const both = !!mine && !!day.theirs;
  return (
    <Screen tabBar={false}>
      <PageHeader title={S.qa.pageTitle} />
      {available === false ? (
        <Sticker id="qa-step" fill={colors.butterSoft} radius={20} offset={3} padding={14} tiltMax={1}>
          <Text variant="bodyStrong">{S.qa.needsStep}</Text>
        </Sticker>
      ) : null}
      <Sticker id="qa-question" fill={colors.blush} radius={radius.xl} offset={6} padding={20} tiltMax={1.2}>
        <Text variant="display" style={{ fontSize: 30, lineHeight: 33 }} testID="qa-question-text" accessibilityRole="header">
          {text}
        </Text>
      </Sticker>
      {!paired ? (
        <Text variant="body">{S.home.notPairedBody}</Text>
      ) : !mine ? (
        <AnswerBox
          partner={partner}
          theirsAnswered={day.theirsAnswered}
          onSend={(t) => {
            const r = answer(t);
            if (r.ok) {
              haptics.success();
              toast.show(S.qa.sent);
            }
          }}
        />
      ) : both ? (
        <FlipPair
          partnerName={partner}
          mine={mine.choice ? answerText(day, mine) : mine.text}
          theirs={day.theirs ? (day.theirs.choice ? answerText(day, day.theirs) : day.theirs.text) : ""}
          revealed={revealedDay === day.day}
          onReveal={() => {
            markRevealed(day.day);
            useEffectsBus.getState().fireHearts(200, 400);
          }}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Sticker id="qa-mine-only" fill={colors.leafSoft} radius={radius.lg} offset={4} padding={14} tiltMax={1}>
            <View style={{ gap: 6 }}>
              <Text variant="caption">{S.qa.yours}</Text>
              <Text variant="bodyStrong" testID="qa-mine-text">
                {mine.text}
              </Text>
            </View>
          </Sticker>
          <Text variant="body" testID="qa-waiting">
            {S.qa.waitingBody(partner)}
          </Text>
          {pendingAnswer && link === "offline" ? <Text variant="caption">{S.qa.queued}</Text> : null}
        </View>
      )}
      {paired ? <Tomorrow /> : null}
      <Archive />
    </Screen>
  );
}
