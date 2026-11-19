import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";

import { Sticker, Text, useTheme } from "@/design";
import { S } from "@/lib/strings.it";
import { answerText, dayQuestion } from "@/lib/qa/legacy";
import { formatLongDate } from "@/lib/time";

import { EventIcon } from "../countdown/EventIcon";
import { ContentArt } from "./ContentArt";
import { Photo } from "./Photo";
import { useMemories, useSignedUrls } from "./useMemories";

/** "Un anno fa oggi": solo se nello stesso giorno di un anno (o più) fa è successo qualcosa. Senza niente da dire non compare. */
export function YearAgoCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const { yearsAgo } = useMemories();
  const first = yearsAgo[0];
  const path = first && first.item.type === "memory" && first.item.memory.path ? first.item.memory.path : null;
  const { urls, failed } = useSignedUrls(path ? [path] : []);
  if (!first) return null;
  const it = first.item;
  return (
    <Sticker id="un-anno-fa" fill={colors.blushSoft} radius={28} offset={5} padding={14} tiltMax={1.5} onPress={() => router.push("/memories")} haptic="light" accessibilityLabel={`${S.memories.yearAgo(first.yearsAgo)}. ${S.memories.openAlbum}`} testID="year-ago">
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {it.type === "memory" && it.memory.kind === "photo" ? (
          <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 2.5, borderColor: colors.outline }}>
            <Photo uri={it.memory.localUri ?? (path ? (urls[path] ?? null) : null)} cacheKey={path ?? it.memory.id} width={92} height={92} label={S.memories.openPhoto(it.memory.caption)} failed={failed} />
          </View>
        ) : it.type === "memory" && it.memory.content ? (
          <ContentArt content={it.memory.content} size={92} />
        ) : it.type === "event" ? (
          <EventIcon id={it.event.icon} size={64} />
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption">{S.memories.yearAgo(first.yearsAgo)}</Text>
          {it.type === "memory" ? <Text variant="title" numberOfLines={3}>{it.memory.caption || (it.memory.kind === "photo" ? S.memories.photoOf("") : S.memories.gameDraw)}</Text> : null}
          {it.type === "event" ? <Text variant="title" numberOfLines={3}>{it.event.title}</Text> : null}
          {it.type === "qa" ? (
            <>
              <Text variant="bodyStrong" numberOfLines={3}>{dayQuestion(it.qa)}</Text>
              <Text variant="caption" numberOfLines={2}>{it.qa.mine ? answerText(it.qa, it.qa.mine) : ""}</Text>
            </>
          ) : null}
          <Text variant="caption">{formatLongDate(it.day)}</Text>
        </View>
      </View>
    </Sticker>
  );
}
