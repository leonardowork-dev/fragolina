import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { Button, EmptyState, Sticker, Text, useEffectsBus, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { radius } from "@/design/tokens";
import { type CountdownEvent } from "@/lib/countdown/rules";
import { S } from "@/lib/strings.it";
import { addDaysIso, formatLongDate } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { PageHeader } from "../common/PageHeader";
import { EventIcon } from "./EventIcon";
import { EventSheet } from "./EventSheet";
import { isParty, unitText, whenText } from "./format";
import { useCountdown } from "./useCountdown";

const FILLS = ["blushSoft", "skySoft", "leafSoft", "butterSoft"] as const;

/** Il numero grande + l'unità di un evento (o "Oggi!"). */
export function BigWhen({ v, size = 56 }: { v: ReturnType<ReturnType<typeof useCountdown>["viewOf"]>; size?: number }) {
  if (isParty(v)) {
    return (
      <Text variant="display" style={{ fontSize: size * 0.7, lineHeight: size * 0.75 }} adjustsFontSizeToFit numberOfLines={1}>
        {v.state === "now" ? S.countdown.partyNow : S.countdown.partyToday}
      </Text>
    );
  }
  return (
    <View style={{ alignItems: "flex-start" }}>
      <Text variant="hero" style={{ fontSize: size, lineHeight: size + 4 }} adjustsFontSizeToFit numberOfLines={1} testID="cd-big">
        {v.big}
      </Text>
      <Text variant="bodyStrong">{unitText(v)}</Text>
    </View>
  );
}

function EventRow({ e, index, onPress }: { e: CountdownEvent; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const { viewOf } = useCountdown();
  const v = viewOf(e);
  const fill = colors[FILLS[index % FILLS.length]!];
  const party = isParty(v);
  return (
    <Sticker
      id={`ev-${e.id}`}
      fill={party ? colors.accent : fill}
      radius={index % 2 ? radius.lg : radius.xl}
      offset={4}
      padding={14}
      tiltMax={1.4}
      onPress={onPress}
      haptic="light"
      accessibilityLabel={S.countdown.a11yEvent(e.title, whenText(v))}
      style={{ marginRight: index % 2 ? 0 : 14, marginLeft: index % 2 ? 14 : 0 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <EventIcon id={e.icon} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={2}>
            {e.title}
          </Text>
          <Text variant="caption">{`${formatLongDate(e.date)}${e.time ? ` · ${e.time}` : ""}`}</Text>
        </View>
        <View style={{ alignItems: "flex-end", minWidth: 64 }}>
          {party ? (
            <Text variant="title">{v.state === "now" ? S.countdown.now : S.countdown.today}</Text>
          ) : (
            <>
              <Text variant="display" style={{ fontSize: 34, lineHeight: 36 }} numberOfLines={1}>
                {v.big}
              </Text>
              <Text variant="caption">{unitText(v)}</Text>
            </>
          )}
        </View>
      </View>
    </Sticker>
  );
}

/** "Manca poco": la lista degli eventi. Il primo (in evidenza o il più vicino) è l'adesivo grande. */
export function CountdownScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { picked, upcoming, past, today, viewOf } = useCountdown();
  const available = useCouple((s) => s.extraAvailable);
  const pending = useCouple((s) => s.queue.some((q) => q.kind === "eventUpsert" || q.kind === "eventDelete"));
  const paired = useCouple((s) => !!s.coupleId);
  const refresh = useCouple((s) => s.refreshExtra);
  const [sheet, setSheet] = useState<{ event: CountdownEvent | null } | null>(null);

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const bigV = picked ? viewOf(picked) : null;
  useEffect(() => {
    if (bigV && isParty(bigV)) useEffectsBus.getState().fireConfetti();
  }, [bigV?.state, picked?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- una festa per evento/stato, non per ogni render

  const rest = upcoming.filter((e) => e.id !== picked?.id);
  return (
    <Screen tabBar={false}>
      <PageHeader title={S.countdown.title} />
      <Text variant="body">{S.countdown.sub}</Text>
      {available === false ? (
        <Sticker id="cd-step" fill={colors.butterSoft} radius={20} offset={3} padding={14} tiltMax={1}>
          <Text variant="bodyStrong">{S.countdown.needsStep}</Text>
        </Sticker>
      ) : null}
      {!paired ? (
        <Text variant="body">{S.home.notPairedBody}</Text>
      ) : upcoming.length === 0 ? (
        <EmptyState mood="sleepy" title={S.countdown.empty} body={S.countdown.emptyBody} />
      ) : null}
      {picked && bigV ? (
        <Sticker
          id="cd-big"
          fill={isParty(bigV) ? colors.accent : colors.butter}
          radius={32}
          offset={6}
          padding={20}
          tiltMax={1.2}
          onPress={() => setSheet({ event: picked })}
          haptic="light"
          accessibilityLabel={S.countdown.a11yEvent(picked.title, whenText(bigV))}
        >
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                {picked.featured ? <Text variant="caption">{S.countdown.featuredBadge}</Text> : null}
                <BigWhen v={bigV} size={72} />
              </View>
              <EventIcon id={picked.icon} size={64} />
            </View>
            <View>
              <Text variant="title" numberOfLines={2}>
                {picked.title}
              </Text>
              <Text variant="caption">{`${formatLongDate(picked.date)}${picked.time ? ` · ${picked.time}` : ""}`}</Text>
              {isParty(bigV) ? <Text variant="bodyStrong">{S.countdown.partyLine}</Text> : null}
            </View>
          </View>
        </Sticker>
      ) : null}
      {rest.map((e, i) => (
        <EventRow key={e.id} e={e} index={i} onPress={() => setSheet({ event: e })} />
      ))}
      {paired ? <Button id="new-event" label={S.countdown.add} icon="plus" onPress={() => setSheet({ event: null })} haptic="light" /> : null}
      {pending ? <Text variant="caption">{S.countdown.queued}</Text> : null}
      {past.length ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text variant="title" accessibilityRole="header">
            {S.countdown.pastTitle}
          </Text>
          <Text variant="caption">{S.countdown.pastNote}</Text>
          {past.slice(0, 8).map((e) => (
            <Sticker key={e.id} id={`past-${e.id}`} fill={colors.surface} radius={18} offset={3} padding={12} tiltMax={1} onPress={() => setSheet({ event: e })} haptic="light" accessibilityLabel={`${e.title}, ${formatLongDate(e.date)}`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <EventIcon id={e.icon} size={30} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text variant="caption">{formatLongDate(e.date)}</Text>
                </View>
              </View>
            </Sticker>
          ))}
        </View>
      ) : null}
      <EventSheet
        visible={sheet !== null}
        event={sheet?.event ?? null}
        defaultDate={addDaysIso(today, 7)}
        onClose={() => setSheet(null)}
        onSaved={() => toast.show(S.countdown.saved)}
        onRemoved={() => toast.show(S.countdown.removed)}
      />
    </Screen>
  );
}
