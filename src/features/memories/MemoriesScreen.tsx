import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { Button, EmptyState, Sheet, Sticker, Text, useTheme, useToast } from "@/design";
import { Screen } from "@/design/layout/Screen";
import { outline, radius } from "@/design/tokens";
import { S } from "@/lib/strings.it";
import { type TimelineItem } from "@/lib/memories/timeline";
import { type PreparedPhoto, discardPhoto, persistPhoto, pickPhoto } from "@/lib/memories/photoDevice";
import { type Memory } from "@/lib/memories/types";
import { answerText, dayQuestion } from "@/lib/qa/legacy";
import { formatLongDate, monthName } from "@/lib/time";
import { useCouple } from "@/state/coupleStore";

import { PageHeader } from "../common/PageHeader";
import { EventIcon } from "../countdown/EventIcon";
import { ContentArt } from "./ContentArt";
import { Photo } from "./Photo";
import { PhotoSheet } from "./PhotoSheet";
import { useMemories, useSignedUrls } from "./useMemories";

function Viewer({ memory, onClose }: { memory: Memory | null; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const me = useCouple((s) => s.userId);
  const partner = useCouple((s) => s.partnerName);
  const meName = useCouple((s) => s.meName);
  const del = useCouple((s) => s.deleteMemory);
  const [ask, setAsk] = useState(false);
  const paths = memory?.path ? [memory.path] : [];
  const { urls, failed } = useSignedUrls(paths);
  const mine = !!memory && memory.by === me;
  const w = Math.min(width - 48, 420);
  const ratio = memory?.w && memory?.h ? memory.w / memory.h : 4 / 3;
  const h = Math.max(160, Math.min(w / ratio, 460));
  return (
    <Sheet visible={memory !== null} onClose={onClose} title={memory ? formatLongDate(memory.day) : ""}>
      {memory ? (
        <View style={{ gap: 14, marginTop: 8 }}>
          {memory.kind === "photo" ? (
            <View style={{ alignSelf: "center", borderRadius: 16, overflow: "hidden", borderWidth: outline.width, borderColor: colors.outline }}>
              <Photo uri={memory.localUri ?? (memory.path ? (urls[memory.path] ?? null) : null)} cacheKey={memory.path ?? memory.id} width={w} height={h} label={S.memories.openPhoto(memory.caption)} failed={failed} />
            </View>
          ) : memory.content ? (
            <View style={{ alignSelf: "center" }}>
              <ContentArt content={memory.content} size={Math.min(w, 300)} />
            </View>
          ) : null}
          {memory.caption ? <Text variant="title">{memory.caption}</Text> : null}
          <Text variant="caption">{S.memories.photoOf(mine ? meName : partner)}</Text>
          {mine ? (
            ask ? (
              <Sticker id="ask-del" fill={colors.blushSoft} radius={20} offset={3} padding={14} tiltMax={1}>
                <View style={{ gap: 10 }}>
                  <Text variant="bodyStrong">{S.memories.deleteAsk}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      id="delete-yes"
                      label={S.memories.deleteYes}
                      variant="danger"
                      onPress={() => {
                        del(memory.id);
                        toast.show(S.memories.deleted);
                        onClose();
                      }}
                    />
                    <Button label={S.memories.deleteNo} variant="secondary" onPress={() => setAsk(false)} />
                  </View>
                </View>
              </Sticker>
            ) : (
              <Button id="delete-memory" label={memory.kind === "photo" ? S.memories.delete : S.memories.deleteKept} variant="ghost" onPress={() => setAsk(true)} />
            )
          ) : memory.kind === "photo" ? (
            <Text variant="caption">{S.memories.onlyMine}</Text>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

function Item({ it, index, onOpen, urls, failed }: { it: TimelineItem; index: number; onOpen: (m: Memory) => void; urls: Record<string, string>; failed: boolean }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const partner = useCouple((s) => s.partnerName);
  const me = useCouple((s) => s.userId);
  const meName = useCouple((s) => s.meName);
  const byName = (m: Memory) => (m.by === me ? meName : partner);
  const col = width - 40;
  if (it.type === "memory") {
    const m = it.memory;
    if (m.kind === "photo") {
      const ratio = m.w && m.h ? m.w / m.h : 4 / 3;
      const w = index % 3 === 1 ? col - 40 : col - 14;
      const h = Math.max(140, Math.min(w / ratio, 380));
      const uri = m.localUri ?? (m.path ? (urls[m.path] ?? null) : null);
      return (
        <Sticker
          id={`mem-${m.id}`}
          fill={index % 2 ? colors.butterSoft : colors.surface}
          radius={22}
          offset={4}
          padding={8}
          tiltMax={1.6}
          onPress={() => onOpen(m)}
          haptic="light"
          accessibilityLabel={`${S.memories.openPhoto(m.caption)}, ${formatLongDate(m.day)}`}
          style={{ alignSelf: index % 3 === 1 ? "flex-end" : "flex-start", marginRight: 14 }}
          testID={`memory-${m.id}`}
        >
          <View style={{ gap: 6 }}>
            <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: colors.outline }}>
              <Photo uri={uri} cacheKey={m.path ?? m.id} width={w - 16 - 4} height={h} label={S.memories.openPhoto(m.caption)} failed={failed} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, gap: 8 }}>
              <Text variant="caption" style={{ flex: 1 }} numberOfLines={2}>
                {m.caption || formatLongDate(m.day)}
              </Text>
              {m.pending ? <Text variant="caption">{S.memories.pending}</Text> : null}
            </View>
          </View>
        </Sticker>
      );
    }
    return (
      <Sticker id={`mem-${m.id}`} fill={colors.blushSoft} radius={22} offset={4} padding={12} tiltMax={1.4} onPress={() => onOpen(m)} haptic="light" accessibilityLabel={`${m.source === "game" ? S.memories.gameDraw : S.memories.noteBy(byName(m))}, ${formatLongDate(m.day)}`} style={{ marginRight: 40 }} testID={`memory-${m.id}`}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          {m.content ? <ContentArt content={m.content} size={96} /> : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption">{m.source === "game" ? S.memories.gameDraw : S.memories.noteBy(byName(m))}</Text>
            {m.caption ? <Text variant="bodyStrong">{m.caption}</Text> : null}
            <Text variant="caption">{formatLongDate(m.day)}</Text>
          </View>
        </View>
      </Sticker>
    );
  }
  if (it.type === "event") {
    return (
      <Sticker id={`mev-${it.event.id}`} fill={colors.skySoft} radius={20} offset={3} padding={12} tiltMax={1.2} accessibilityRole="text" accessibilityLabel={`${S.memories.eventPast}: ${it.event.title}, ${formatLongDate(it.event.date)}`} style={{ marginLeft: 30 }} testID="memory-event">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <EventIcon id={it.event.icon} size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="caption">{S.memories.eventPast}</Text>
            <Text variant="bodyStrong">{it.event.title}</Text>
            <Text variant="caption">{formatLongDate(it.event.date)}</Text>
          </View>
        </View>
      </Sticker>
    );
  }
  if (it.type === "qa") {
    const q = it.qa;
    return (
      <Sticker id={`mqa-${q.day}`} fill={colors.surface} radius={20} offset={3} padding={14} tiltMax={1} accessibilityRole="text" style={{ marginRight: 24 }} testID="memory-qa">
        <View style={{ gap: 8 }}>
          <Text variant="caption">{`${S.memories.qaTitle} · ${formatLongDate(q.day)}`}</Text>
          <Text variant="bodyStrong">{dayQuestion(q)}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: colors.leafSoft, borderRadius: 12, padding: 8, borderWidth: 2, borderColor: colors.outline }}>
              <Text variant="caption" numberOfLines={4}>
                {q.mine ? answerText(q, q.mine) : ""}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.skySoft, borderRadius: 12, padding: 8, borderWidth: 2, borderColor: colors.outline }}>
              <Text variant="caption" numberOfLines={4}>
                {q.theirs ? answerText(q, q.theirs) : ""}
              </Text>
            </View>
          </View>
        </View>
      </Sticker>
    );
  }
  return (
    <Sticker id={`mms-${it.day}-${it.label}`} fill={colors.butter} radius={radius.round} offset={4} padding={0} tiltMax={2} accessibilityRole="text" style={{ alignSelf: "center" }} testID="memory-milestone">
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, alignItems: "center" }}>
        <Text variant="title">{it.label}</Text>
        <Text variant="caption">{formatLongDate(it.day)}</Text>
      </View>
    </Sticker>
  );
}

/** Ricordi: l'album della coppia, una timeline per mese. */
export function MemoriesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const paired = useCouple((s) => !!s.coupleId);
  const available = useCouple((s) => s.extraAvailable);
  const refresh = useCouple((s) => s.refreshExtra);
  const { timeline, memories, today } = useMemories();
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [open, setOpen] = useState<Memory | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const paths = useMemo(() => memories.flatMap((m) => (m.path && !m.localUri ? [m.path] : [])), [memories]);
  const { urls, failed } = useSignedUrls(paths);

  const add = async () => {
    setBusy(true);
    const r = await pickPhoto();
    if (r.ok) {
      const stable = await persistPhoto(r.photo.uri, "pending-" + Date.now()).catch(() => r.photo.uri);
      setPrepared({ ...r.photo, uri: stable });
    } else if (r.reason === "failed") toast.show(S.memories.pickFailed);
    setBusy(false);
  };

  // la copia "pending-…" non serve più se la foto non viene aggiunta: si pulisce quando si chiude senza salvare
  const closeSheet = (saved: boolean) => {
    if (!saved && prepared) void discardPhoto(prepared.uri);
    setPrepared(null);
  };

  return (
    <Screen tabBar={false}>
      <PageHeader title={S.memories.title} />
      <Text variant="body">{S.memories.sub}</Text>
      {available === false ? (
        <Sticker id="mem-step" fill={colors.butterSoft} radius={20} offset={3} padding={14} tiltMax={1}>
          <Text variant="bodyStrong">{S.memories.needsStep}</Text>
        </Sticker>
      ) : null}
      {paired ? (
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Button id="add-photo" label={busy ? S.memories.picking : S.memories.add} icon="plus" disabled={busy || available === false} onPress={() => void add()} />
          <Sticker id="to-month" fill={colors.sky} radius={999} offset={3} padding={0} tiltMax={1.4} onPress={() => router.push("/month")} haptic="light" accessibilityLabel={S.memories.monthLink}>
            <Text variant="bodyStrong" style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
              {S.memories.monthLink}
            </Text>
          </Sticker>
        </View>
      ) : (
        <Text variant="body">{S.home.notPairedBody}</Text>
      )}
      {paired && timeline.length === 0 ? <EmptyState mood="sleepy" title={S.memories.empty} body={S.memories.emptyBody} /> : null}
      {timeline.map((mo) => (
        <View key={mo.key} style={{ gap: 14 }}>
          <Text variant="display" accessibilityRole="header" style={{ marginTop: 10 }}>
            {`${monthName(mo.month)} ${mo.year}`}
          </Text>
          {mo.items.map((it, i) => (
            <Item key={`${it.type}-${"memory" in it ? it.memory.id : "event" in it ? it.event.id : "qa" in it ? it.qa.day : it.label}-${i}`} it={it} index={i} onOpen={setOpen} urls={urls} failed={failed} />
          ))}
        </View>
      ))}
      <PhotoSheet photo={prepared} today={today} onClose={closeSheet} />
      <Viewer key={open?.id ?? "none"} memory={open ? (memories.find((m) => m.id === open.id) ?? open) : null} onClose={() => setOpen(null)} />
    </Screen>
  );
}
