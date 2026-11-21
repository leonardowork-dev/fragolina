import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Button, Chip, Sheet, Sticker, StickerPressable, Text, TextField, useTheme } from "@/design";
import { haptics } from "@/lib/haptics";
import { play } from "@/lib/sound";
import { S } from "@/lib/strings.it";
import { localDayKey, monthName } from "@/lib/time";
import { uuid } from "@/lib/uuid";
import { heartsFor, countsByDay, milestones, MILESTONE_IDS, monthGrid, newMilestone, zoneStats } from "@/lib/zone/stats";
import { PLACES, type Place, type Starter, type ZEntry } from "@/lib/zone/types";
import { useCouple } from "@/state/coupleStore";
import { selectZoneView, useZone } from "@/state/zoneStore";

import { FlameArt, HeartArt } from "./ZoneArt";
import { useHeat } from "./HeatBurst";

const WEEK = ["L", "M", "M", "G", "V", "S", "D"];

function DayCell({ day, count, today, onPress }: { day: string; count: number; today: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const h = heartsFor(count);
  return (
    <StickerPressable
      accessibilityLabel={`${day}: ${count}`}
      onPress={onPress}
      haptic="tick"
      style={{ width: "14.28%", minHeight: 52, alignItems: "center", paddingVertical: 4, borderRadius: 10, backgroundColor: today ? colors.butterSoft : "transparent" }}
    >
      <Text variant="caption" style={{ fontSize: 11 }}>{Number(day.slice(8))}</Text>
      {h.big !== null ? (
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          <HeartArt size={26} />
          <Text variant="caption" style={{ position: "absolute", fontSize: 9, color: "#FFF", fontWeight: "800" }}>{`×${h.big}`}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", width: 34 }}>
          {Array.from({ length: h.small }, (_, i) => <HeartArt key={i} size={h.small > 2 ? 11 : 15} />)}
        </View>
      )}
    </StickerPressable>
  );
}

function DaySheet({ day, onClose }: { day: string | null; onClose: () => void }) {
  const role = useCouple((s) => s.myRole);
  const zone = useZone();
  const view = selectZoneView(zone, role, zone.snapshot.now);
  const list = day ? view.entries.filter((e) => e.day === day) : [];
  const [editing, setEditing] = useState<string | null>(null);
  const add = () => day && zone.enqueue({ kind: "log", id: uuid(), day, at: Date.now(), place: null, starter: null, rating: null, note: null });
  return (
    <Sheet visible={day !== null} onClose={onClose} title={day ?? ""}>
      <View style={{ gap: 12, marginTop: 8 }}>
        {list.length === 0 ? <Text variant="body">{S.zone.dayEmpty}</Text> : null}
        {list.map((e) => (editing === e.id ? <EntryEditor key={e.id} entry={e} onDone={() => setEditing(null)} /> : <EntryRow key={e.id} entry={e} onPress={() => setEditing(e.id)} />))}
        <Button label={S.zone.addHere} variant="secondary" onPress={add} />
      </View>
    </Sheet>
  );
}

function EntryRow({ entry, onPress }: { entry: ZEntry; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Sticker id={`ze-${entry.id}`} fill={colors.blushSoft} radius={18} offset={3} padding={12} tiltMax={0.8} onPress={onPress} accessibilityLabel={S.zone.save}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <HeartArt size={22} />
        <Text variant="bodyStrong">{entry.place ? S.zone.places[entry.place] : "—"}</Text>
        <View style={{ flexDirection: "row" }}>{Array.from({ length: entry.rating ?? 0 }, (_, i) => <FlameArt key={i} size={16} />)}</View>
        {entry.note ? <Text variant="caption" style={{ flexBasis: "100%" }}>{entry.note}</Text> : null}
      </View>
    </Sticker>
  );
}

function EntryEditor({ entry, onDone }: { entry: ZEntry; onDone: () => void }) {
  const enqueue = useZone((s) => s.enqueue);
  const role = useCouple((s) => s.myRole);
  const [place, setPlace] = useState<Place | null>(entry.place);
  const [starter, setStarter] = useState<Starter | null>(entry.starter);
  const [rating, setRating] = useState<number | null>(entry.rating);
  const [note, setNote] = useState(entry.note ?? "");
  // "io/tu" dal punto di vista di questo telefono → ruolo a/b sul server
  const mine: Starter | null = role;
  const yours: Starter | null = role === "a" ? "b" : role === "b" ? "a" : null;
  const save = () => {
    enqueue({ kind: "log", id: entry.id, day: entry.day, at: entry.at, place, starter, rating, note: note.trim() || null });
    onDone();
  };
  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption">{S.zone.where}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PLACES.map((p) => <Chip key={p} id={`pl-${p}`} label={S.zone.places[p]} selected={place === p} onPress={() => setPlace(place === p ? null : p)} />)}
      </View>
      <Text variant="caption">{S.zone.who}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip id="st-me" label={S.zone.starter.me} selected={starter === mine && mine !== null} onPress={() => setStarter(mine && starter !== mine ? mine : null)} />
        <Chip id="st-you" label={S.zone.starter.you} selected={starter === yours && yours !== null} onPress={() => setStarter(yours && starter !== yours ? yours : null)} />
        <Chip id="st-both" label={S.zone.starter.both} selected={starter === "both"} onPress={() => setStarter(starter === "both" ? null : "both")} />
      </View>
      <Text variant="caption">{S.zone.heat}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <StickerPressable key={n} accessibilityLabel={`${S.zone.heat} ${n}`} haptic="tick" onPress={() => setRating(rating === n ? null : n)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
            <FlameArt size={30} on={(rating ?? 0) >= n} />
          </StickerPressable>
        ))}
      </View>
      <TextField label={S.zone.note} value={note} onChange={setNote} maxLength={140} placeholder={S.zone.notePlaceholder} autoCapitalize="sentences" />
      <Button label={S.zone.save} onPress={save} />
      <Button label={S.zone.remove} variant="ghost" onPress={() => { useZone.getState().enqueue({ kind: "logDelete", id: entry.id }); onDone(); }} />
    </View>
  );
}

export function CalendarTab() {
  const { colors } = useTheme();
  const role = useCouple((s) => s.myRole);
  const zone = useZone();
  const view = useMemo(() => selectZoneView(zone, role, zone.snapshot.now || 1), [zone, role]);
  const today = view.today || localDayKey();
  const [ym, setYm] = useState<[number, number]>(() => [Number(today.slice(0, 4)) || 2026, Number(today.slice(5, 7)) || 1]);
  const [day, setDay] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const counts = useMemo(() => countsByDay(view.entries), [view.entries]);
  const stats = useMemo(() => zoneStats(view.entries, today, role), [view.entries, today, role]);
  const done = useMemo(() => milestones(view.entries, today), [view.entries, today]);

  const plusOne = () => {
    const before = milestones(view.entries, today);
    const id = uuid();
    zone.enqueue({ kind: "log", id, day: today, at: Date.now(), place: null, starter: null, rating: null, note: null });
    haptics.success();
    play("pop");
    const after = milestones([...view.entries, { id, day: today, at: 0, place: null, starter: null, rating: null, note: null, by: role, updatedAt: 0 }], today);
    const m = newMilestone(before, after);
    useHeat.getState().fire(m ? "milestone" : "plus", m ? S.zone.milestoneNew(S.zone.milestone[m]) : null);
    setUndoId(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoId(null), 10_000);
  };
  const undo = () => {
    if (!undoId) return;
    zone.enqueue({ kind: "logDelete", id: undoId });
    setUndoId(null);
    haptics.light();
  };
  const move = (d: number) => {
    const t = ym[0] * 12 + (ym[1] - 1) + d;
    setYm([Math.floor(t / 12), (t % 12) + 1]);
  };
  const cells = monthGrid(ym[0], ym[1]);

  return (
    <View style={{ gap: 16 }}>
      <Sticker id="zone-cal" fill={colors.surface} radius={26} offset={4} padding={12} tiltMax={0.6} style={{ marginRight: 6 }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <StickerPressable accessibilityLabel={S.zone.prev} haptic="tick" onPress={() => move(-1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Text variant="title">‹</Text></StickerPressable>
            <Text variant="title" accessibilityRole="header">{`${monthName(ym[1])} ${ym[0]}`}</Text>
            <StickerPressable accessibilityLabel={S.zone.next} haptic="tick" onPress={() => move(1)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><Text variant="title">›</Text></StickerPressable>
          </View>
          <View style={{ flexDirection: "row" }}>{WEEK.map((w, i) => <Text key={i} variant="caption" style={{ width: "14.28%", textAlign: "center" }}>{w}</Text>)}</View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((c, i) => (c ? <DayCell key={c} day={c} count={counts.get(c) ?? 0} today={c === today} onPress={() => setDay(c)} /> : <View key={`e${i}`} style={{ width: "14.28%", minHeight: 52 }} />))}
          </View>
        </View>
      </Sticker>

      <Sticker id="zone-plus" fill={colors.accent} radius={32} offset={6} padding={20} tiltMax={1.2} pressScale={0.95} haptic="success" onPress={plusOne} accessibilityLabel={S.zone.plusOneLabel} faceStyle={{ minHeight: 120, alignItems: "center", justifyContent: "center" }}>
        <Text variant="hero" style={{ color: "#FFF" }}>{S.zone.plusOne}</Text>
      </Sticker>
      {undoId ? (
        <Sticker id="zone-undo" fill={colors.butter} radius={20} offset={3} padding={10} tiltMax={0.8} style={{ marginRight: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text variant="caption" style={{ flex: 1 }}>{S.zone.undoHint}</Text>
            <Button label={S.zone.undo} variant="secondary" onPress={undo} />
          </View>
        </Sticker>
      ) : null}

      <Text variant="title" accessibilityRole="header">{S.zone.statsTitle}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Stat id="s-month" big={String(stats.thisMonth)} label={S.zone.stat.month} fill={colors.blush} />
        <Stat id="s-total" big={String(stats.total)} label={S.zone.stat.total} fill={colors.butterSoft} />
        <Stat id="s-record" big={stats.recordDay ? `×${stats.recordDay.count}` : S.zone.stat.none} label={S.zone.stat.record} fill={colors.skySoft} />
        <Stat id="s-week" big={stats.hottestWeek ? String(stats.hottestWeek.count) : S.zone.stat.none} label={S.zone.stat.week} fill={colors.leafSoft} />
        <Stat id="s-streak" big={String(stats.streak)} label={S.zone.stat.streak} fill={colors.blushSoft} />
        <Stat id="s-place" big={stats.favoritePlace ? S.zone.places[stats.favoritePlace] : S.zone.stat.none} label={S.zone.stat.place} fill={colors.butter} small />
        <Stat id="s-rating" big={stats.avgRating !== null ? String(stats.avgRating) : S.zone.stat.none} label={S.zone.stat.rating} fill={colors.blush} />
        <Stat id="s-starter" big={starterWho(stats.starter)} label={S.zone.stat.starter} fill={colors.skySoft} small />
      </View>

      <Text variant="title" accessibilityRole="header">{S.zone.milestonesTitle}</Text>
      <View style={{ gap: 8 }}>
        {MILESTONE_IDS.map((m) => (
          <Sticker key={m} id={`ms-${m}`} fill={done.has(m) ? colors.butter : colors.surface} radius={16} offset={done.has(m) ? 3 : 0} padding={10} tiltMax={0.8} style={{ marginRight: 6, opacity: done.has(m) ? 1 : 0.6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <FlameArt size={22} on={done.has(m)} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>{S.zone.milestone[m]}</Text>
              {!done.has(m) ? <Text variant="caption">{S.zone.milestoneLocked}</Text> : null}
            </View>
          </Sticker>
        ))}
      </View>
      <DaySheet day={day} onClose={() => setDay(null)} />
    </View>
  );
}

function starterWho(s: { me: number; you: number; both: number }): string {
  if (s.me === 0 && s.you === 0) return S.zone.stat.none;
  if (s.me === s.you) return S.zone.stat.starterTie;
  return s.me > s.you ? S.zone.stat.starterMe : S.zone.stat.starterYou;
}

function Stat({ id, big, label, fill, small }: { id: string; big: string; label: string; fill: string; small?: boolean }) {
  return (
    <Sticker id={id} fill={fill} radius={20} offset={3} padding={12} tiltMax={1.4} style={{ width: "47%" }}>
      <View style={{ gap: 2 }}>
        <Text variant={small ? "title" : "hero"} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.5} style={small ? undefined : { fontSize: 38, lineHeight: 42 }}>{big}</Text>
        <Text variant="caption">{label}</Text>
      </View>
    </Sticker>
  );
}
