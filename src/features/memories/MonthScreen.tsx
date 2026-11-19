import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { Icon, MoodSticker, Skeleton, Sticker, StickerPressable, Text, useTheme } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { outline } from "@/design/tokens";
import { type MonthRaw, monthView } from "@/lib/memories/month";
import { S } from "@/lib/strings.it";
import { monthName } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { useMinuteClock } from "../common/useMinuteClock";
import { PageHeader } from "../common/PageHeader";

function Big({ n, caption, sub, fill, id, tilt = 1.4, grow = 1 }: { n: number; caption: string; sub?: string; fill: string; id: string; tilt?: number; grow?: number }) {
  return (
    <Sticker id={id} fill={fill} radius={26} offset={5} padding={16} tiltMax={tilt} style={{ flexGrow: grow, flexBasis: 0 }} accessibilityRole="text" accessibilityLabel={`${caption}: ${n}${sub ? ` ${sub}` : ""}`}>
      <View style={{ gap: 2 }}>
        <Text variant="caption">{caption}</Text>
        <Text variant="hero" style={{ fontSize: 56, lineHeight: 60 }} adjustsFontSizeToFit numberOfLines={1} testID={`month-${id}`}>
          {n}
        </Text>
        {sub ? <Text variant="caption">{sub}</Text> : null}
      </View>
    </Sticker>
  );
}

/** "Il nostro mese": gli umori di entrambi, quanti pensieri, quante partite. Adesivi e numeri grandi, niente grafici. */
export function MonthScreen() {
  const { colors } = useTheme();
  const now = useMinuteClock();
  const me = useCouple((s) => s.userId);
  const partner = useCouple((s) => s.partnerName);
  const available = useCouple((s) => s.extraAvailable);
  const fetchMonth = useCouple((s) => s.fetchMonth);
  const [cursor, setCursor] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() + 1 }));
  const curKey = `${cursor.y}-${cursor.m}`;
  const [res, setRes] = useState<{ key: string; raw: MonthRaw | null | "error" } | null>(null);
  const raw: MonthRaw | null | "loading" | "error" = res && res.key === curKey ? res.raw : "loading";

  useEffect(() => {
    let alive = true;
    fetchMonth(cursor.y, cursor.m)
      .then((r) => alive && setRes({ key: curKey, raw: r }))
      .catch(() => alive && setRes({ key: curKey, raw: "error" }));
    return () => {
      alive = false;
    };
  }, [cursor, curKey, fetchMonth]);

  const view = useMemo(() => (raw && raw !== "loading" && raw !== "error" ? monthView(raw, me ?? "") : null), [raw, me]);
  const isNow = cursor.y === now.getFullYear() && cursor.m === now.getMonth() + 1;
  const go = (d: number) => setCursor((c) => {
    const t = c.y * 12 + (c.m - 1) + d;
    return { y: Math.floor(t / 12), m: (t % 12) + 1 };
  });
  const empty = !!view && !view.topMine && !view.topTheirs && !view.pingsMine && !view.pingsTheirs && !view.games && !view.qaBoth;

  const nav = (label: string, d: number, disabled: boolean, icon: "back" | "forward") => (
    <StickerPressable
      accessibilityLabel={label}
      haptic="tick"
      disabled={disabled}
      onPress={() => go(d)}
      style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sky, borderWidth: outline.width, borderColor: colors.outline, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : 1 }}
    >
      <Icon name={icon} size={24} />
    </StickerPressable>
  );

  const moodStrip = (who: string, mood: ReturnType<typeof monthView>["days"], key: "mine" | "theirs", top: { mood: NonNullable<(typeof mood)[number]["mine"]>; n: number } | null, fill: string, id: string) => (
    <Sticker id={id} fill={fill} radius={26} offset={5} padding={16} tiltMax={1.2} accessibilityRole="text" accessibilityLabel={`${who}: ${top ? S.moods[top.mood] : S.month.noMood}`}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {top ? <MoodSticker mood={top.mood} size={84} /> : <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: outline.width, borderStyle: "dashed", borderColor: colors.outline, backgroundColor: colors.ground }} />}
          <View style={{ flex: 1 }}>
            <Text variant="caption">{who}</Text>
            <Text variant="title" numberOfLines={2}>
              {top ? S.moods[top.mood] : S.month.noMood}
            </Text>
            {top ? <Text variant="caption">{`${S.month.mostOften} · ${S.month.times(top.n)}`}</Text> : null}
          </View>
        </View>
        {mood.some((d) => d[key]) ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {mood.filter((d) => d[key]).map((d) => (
              <View key={d.day} style={{ alignItems: "center", width: 34 }} accessible accessibilityLabel={`${S.month.dayTitle(d.day)}: ${S.moods[d[key]!]}`}>
                <MoodSticker mood={d[key]!} size={30} />
                <Text variant="caption" style={{ fontSize: 11, lineHeight: 13 }}>
                  {d.day}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Sticker>
  );

  return (
    <Screen tabBar={false}>
      <PageHeader title={S.month.title} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        {nav(S.month.prev, -1, false, "back")}
        <Text variant="title" testID="month-label" accessibilityRole="header" style={{ flex: 1, textAlign: "center" }}>
          {`${monthName(cursor.m)} ${cursor.y}`}
        </Text>
        {nav(S.month.next, 1, isNow, "forward")}
      </View>
      {available === false ? (
        <Sticker id="month-step" fill={colors.butterSoft} radius={20} offset={3} padding={14} tiltMax={1}>
          <Text variant="bodyStrong">{S.month.needsStep}</Text>
        </Sticker>
      ) : null}
      {raw === "loading" ? <Skeleton width={300} height={120} radius={26} /> : null}
      {view ? (
        <>
          {empty ? <Text variant="body">{S.month.emptyMonth}</Text> : null}
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Big id="pensieri-tuoi" n={view.pingsMine} caption={S.month.thoughts} sub={S.month.thoughtsYou} fill={colors.accent} />
            <Big id="pensieri-suoi" n={view.pingsTheirs} caption={S.month.thoughts} sub={S.month.thoughtsThem(partner)} fill={colors.blush} tilt={2} />
          </View>
          {moodStrip(S.month.you, view.days, "mine", view.topMine, colors.butterSoft, "umori-miei")}
          {moodStrip(partner, view.days, "theirs", view.topTheirs, colors.skySoft, "umori-suoi")}
          <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
            <Big id="partite" n={view.games} caption={S.month.games} sub={S.month.gamesSub} fill={colors.leafSoft} grow={1} />
            <Big id="domande" n={view.qaBoth} caption={S.month.qa} sub={S.month.qaSub} fill={colors.butter} grow={1.3} tilt={1.8} />
          </View>
        </>
      ) : null}
      {raw === "error" ? <Text variant="body">{S.pairing.errors.network}</Text> : null}
    </Screen>
  );
}
